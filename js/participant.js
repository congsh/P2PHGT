/**
 * P2P海龟汤在线房间 - 参与者功能模块
 * 负责处理参与者加入房间、提问和互动等功能
 */

const participantManager = {
    /**
     * 加入游戏
     */
    joinGame: function() {
        console.log("[参与者] 开始加入游戏流程");
        // 获取昵称和邀请码
        const nickname = document.getElementById('participantName').value.trim();
        const inviteCode = document.getElementById('inviteCode').value.trim();
        
        // 验证必填字段
        if (!nickname) {
            alert('请输入你的昵称');
            return;
        }
        
        if (!inviteCode) {
            alert('请输入主持人分享的邀请码');
            return;
        }
        
        console.log("[参与者] 昵称和邀请码验证通过");
        
        // 保存参与者信息
        appState.role = 'participant';
        appState.nickname = nickname;
        
        console.log("[参与者] 初始化P2P连接管理器");
        // 初始化P2P管理器
        appState.peerManager = new PeerManager(
            'participant',
            this.handlePeerMessage,
            this.handlePeerConnected,
            this.handlePeerDisconnected
        );
        
        try {
            // 解析邀请码
            console.log("[参与者] 解析邀请码...");
            const inviteData = appState.peerManager.parseInviteCode(inviteCode);
            
            if (!inviteData || !inviteData.hostId || !inviteData.roomSettings) {
                console.error("[参与者] 邀请码格式错误:", inviteData);
                throw new Error('邀请码格式错误');
            }
            
            console.log("[参与者] 解析成功，主持人ID:", inviteData.hostId);
            console.log("[参与者] 房间设置:", inviteData.roomSettings);
            
            // 保存游戏信息
            appState.gameInfo.title = inviteData.roomSettings.title;
            appState.gameInfo.rules = inviteData.roomSettings.rules;
            
            console.log("[参与者] 生成响应码...");
            // 生成响应码
            appState.peerManager.generateResponseCode(inviteData.hostId, nickname)
                .then(responseCode => {
                    console.log("[参与者] 响应码生成成功，长度:", responseCode.length);
                    document.getElementById('responseCode').value = responseCode;
                    
                    // 更新提示信息，简化流程
                    const infoText = document.querySelector('.info-text');
                    if (infoText) {
                        infoText.innerHTML = `
                            <div style="margin-bottom: 10px;">
                                请将上方响应码复制给主持人，然后等待连接建立
                            </div>
                        `;
                    }
                    
                    // 切换到等待连接视图
                    viewManager.switchTo('participantWaitingView');
                    
                    // 启动自动检查应答信号的轮询
                    console.log("[参与者] 启动信号检查轮询");
                    const signalChannel = `webrtc_signal_${appState.peerManager.myId}`;
                    const signalCheckInterval = setInterval(() => {
                        try {
                            const storedSignal = localStorage.getItem(signalChannel);
                            if (storedSignal) {
                                console.log(`[参与者] 发现存储的应答信号，处理中...`);
                                const result = appState.peerManager.processAnswerCode(storedSignal);
                                if (result) {
                                    console.log("[参与者] 应答信号处理成功");
                                    localStorage.removeItem(signalChannel);
                                    clearInterval(signalCheckInterval);
                                    
                                    // 更新UI显示
                                    const infoText = document.querySelector('.info-text');
                                    if (infoText) {
                                        infoText.innerHTML = '<p>连接建立中，请稍候...</p>';
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("[参与者] 信号检查失败:", e);
                        }
                    }, 1000); // 每秒检查一次
                });
        } catch (error) {
            console.error("[参与者] 加入游戏失败:", error);
            alert('解析邀请码失败: ' + error.message);
        }
    },
    
    /**
     * 发送问题
     */
    sendQuestion: function() {
        // 获取问题内容
        const questionInput = document.getElementById('questionInput');
        const questionContent = questionInput.value.trim();
        
        if (!questionContent) {
            alert('请输入你的问题');
            return;
        }
        
        // 自由模式下可直接提问，举手模式下需要被点名后才能提问
        const isRaiseHandMode = appState.gameInfo.rules.questionMode === 'raiseHand';
        if (isRaiseHandMode && !this.isCalledByHost) {
            alert('请先举手并等待主持人点名');
            return;
        }
        
        // 创建问题消息
        const questionMessage = {
            type: 'C2H_QUESTION',
            payload: { content: questionContent }
        };
        
        // 发送给主持人
        appState.peerManager.sendToHost(questionMessage);
        
        // 清空输入框
        questionInput.value = '';
        
        // 如果是在举手模式下被点名的，重置点名状态
        if (isRaiseHandMode && this.isCalledByHost) {
            this.isCalledByHost = false;
            document.getElementById('questionInput').placeholder = '输入你的问题...';
            document.getElementById('raiseHandBtn').disabled = false;
        }
    },
    
    /**
     * 举手
     */
    raiseHand: function() {
        // 如果不是举手模式，不执行操作
        if (appState.gameInfo.rules.questionMode !== 'raiseHand') {
            return;
        }
        
        // 创建举手消息
        const raiseHandMessage = {
            type: 'C2H_INTERACTION',
            payload: { type: 'raise_hand' }
        };
        
        // 发送给主持人
        appState.peerManager.sendToHost(raiseHandMessage);
        
        // 禁用举手按钮，防止重复点击
        document.getElementById('raiseHandBtn').disabled = true;
        
        // 显示已举手的提示
        alert('已举手，等待主持人点名');
    },
    
    /**
     * 发送互动消息
     * @param {string} interactionType - 互动类型：'throw_flower' 或 'throw_trash'
     */
    sendInteraction: function(interactionType) {
        // 如果互动功能已禁用，则不执行
        if (appState.gameInfo.rules.interactionMode === 'disallow') {
            alert('主持人已禁用互动功能');
            return;
        }
        
        // 创建互动消息
        const interactionMessage = {
            type: 'C2H_INTERACTION',
            payload: { type: interactionType }
        };
        
        // 发送给主持人
        appState.peerManager.sendToHost(interactionMessage);
        
        // 根据互动类型显示提示
        const actionText = interactionType === 'throw_flower' ? '已送出鲜花' : '已扔出垃圾';
        alert(actionText);
    },
    
    /**
     * 处理收到的主持人消息
     * @param {Object} message - 消息对象
     */
    handlePeerMessage: function(message) {
        switch(message.type) {
            case 'H2A_QUESTION_RELAY': // 主持人转发的问题
                participantManager.appendToChatHistory({
                    type: 'question',
                    sender: message.payload.from,
                    content: message.payload.content
                });
                break;
                
            case 'H2A_ANSWER': // 主持人的回答
                let answerText;
                switch(message.payload.answer) {
                    case 'yes': 
                        answerText = '是';
                        break;
                    case 'no': 
                        answerText = '否';
                        break;
                    case 'uncertain': 
                        answerText = '不确定';
                        break;
                }
                
                participantManager.appendToChatHistory({
                    type: 'answer',
                    content: answerText
                });
                break;
                
            case 'H2A_CLUE': // 主持人发布的情报
                participantManager.appendToChatHistory({
                    type: 'clue',
                    sender: '主持人',
                    content: message.payload.content
                });
                break;
                
            case 'H2A_GAME_STATE': // 游戏状态同步
                console.log("[参与者] 收到游戏状态同步消息:", message.payload);
                // 更新游戏信息
                appState.gameInfo.title = message.payload.title;
                appState.gameInfo.rules = message.payload.rules;
                
                // 更新UI显示
                document.getElementById('participantGameTitle').textContent = message.payload.title;
                
                // 显示汤底类型
                const soupTypeElement = document.getElementById('participantSoupType');
                if (soupTypeElement) {
                    const soupTypeText = message.payload.rules.soupType === 'red' ? '红汤' : '非红汤';
                    soupTypeElement.textContent = `汤底类型：${soupTypeText}`;
                }
                
                console.log("[参与者] 更新参与者列表");
                // 更新参与者列表
                const participantsList = document.getElementById('participantViewList');
                participantsList.innerHTML = '';
                message.payload.participants.forEach(nickname => {
                    const li = document.createElement('li');
                    li.textContent = nickname;
                    participantsList.appendChild(li);
                });
                document.getElementById('participantViewCount').textContent = message.payload.participants.length;
                
                console.log("[参与者] 根据规则调整UI显示");
                // 根据规则调整UI显示
                if (appState.gameInfo.rules.questionMode === 'raiseHand') {
                    document.getElementById('raiseHandBtn').style.display = 'inline-block';
                } else {
                    document.getElementById('raiseHandBtn').style.display = 'none';
                }
                
                if (appState.gameInfo.rules.interactionMode === 'allow') {
                    document.getElementById('throwFlowerBtn').style.display = 'inline-block';
                    document.getElementById('throwTrashBtn').style.display = 'inline-block';
                } else {
                    document.getElementById('throwFlowerBtn').style.display = 'none';
                    document.getElementById('throwTrashBtn').style.display = 'none';
                }
                
                // 如果有聊天历史，加载历史消息
                if (message.payload.history && message.payload.history.length > 0) {
                    console.log("[参与者] 加载历史消息, 数量:", message.payload.history.length);
                    message.payload.history.forEach(msg => {
                        participantManager.appendToChatHistory(msg);
                    });
                }
                
                console.log("[参与者] 切换到游戏视图");
                // 切换到游戏视图
                viewManager.switchTo('participantGameView');
                
                // 发送确认消息
                try {
                    console.log("[参与者] 发送游戏状态接收确认");
                    setTimeout(() => {
                        appState.peerManager.sendToHost({
                            type: 'C2H_INTERACTION',
                            payload: { 
                                type: 'game_state_received',
                                timestamp: new Date().getTime() 
                            }
                        });
                    }, 500);
                } catch (e) {
                    console.error("[参与者] 发送确认消息失败", e);
                }
                break;
                
            case 'H2A_INTERACTION_RELAY': // 互动消息转发
                if (message.payload.type === 'call_participant') {
                    // 检查是否被点名
                    if (message.payload.participantId === appState.peerManager.myId) {
                        participantManager.handleBeingCalled();
                    }
                } 
                else if (message.payload.type === 'disconnect') {
                    // 有参与者断开连接
                    participantManager.appendToChatHistory({
                        type: 'system',
                        content: `${message.payload.from} 已断开连接`
                    });
                }
                else if (message.payload.type === 'connection_test_response') {
                    // 处理连接测试的应答
                    console.log("收到主持人的连接测试应答");
                    const loadingElement = document.querySelector('.loading-indicator');
                    if (loadingElement) {
                        loadingElement.innerHTML = '<p>连接已确认，等待主持人开始游戏...</p>';
                    }
                }
                else {
                    // 其他互动消息
                    let actionText = '';
                    if (message.payload.type === 'throw_flower') {
                        actionText = '送出了一朵花';
                    } else if (message.payload.type === 'throw_trash') {
                        actionText = '扔出了垃圾';
                    } else if (message.payload.type === 'raise_hand') {
                        actionText = '举手了';
                    }
                    
                    if (actionText) {
                        participantManager.appendToChatHistory({
                            type: 'interaction',
                            sender: message.payload.from,
                            content: actionText
                        });
                    }
                }
                break;
                
            case 'H2A_GAME_END': // 游戏结束
                document.getElementById('endGameTitle').textContent = appState.gameInfo.title;
                document.getElementById('endGameSolution').textContent = message.payload.solution;
                viewManager.switchTo('gameEndView');
                break;
        }
    },
    
    /**
     * 处理与主持人连接成功事件
     * @param {string} peerId - 连接的对等方ID
     * @param {string} nickname - 连接的对等方昵称
     */
    handlePeerConnected: function(peerId, nickname) {
        console.log("连接已建立，对方ID:", peerId);
        
        // 连接成功后，显示连接成功的提示
        // 注意：此时还没有收到游戏状态信息，需等待主持人发送游戏状态
        const loadingElement = document.querySelector('.loading-indicator');
        if (loadingElement) {
            loadingElement.innerHTML = '<p>与主持人成功连接，等待游戏开始...</p>';
        }
        
        // 发送一个测试消息给主持人，确保双向通信正常
        setTimeout(() => {
            try {
                console.log("尝试向主持人发送测试消息");
                const testMessage = {
                    type: "C2H_INTERACTION",
                    payload: {
                        type: "connection_test",
                        message: "测试连接"
                    }
                };
                appState.peerManager.sendToHost(testMessage);
                console.log("测试消息已发送");
            } catch (e) {
                console.error("发送测试消息失败", e);
            }
        }, 1000);
    },
    
    /**
     * 处理与主持人断开连接事件
     */
    handlePeerDisconnected: function() {
        // 显示连接断开提示
        alert('与主持人的连接已断开');
        
        // 返回欢迎页面
        viewManager.switchTo('welcomeView');
        resetAppState();
    },
    
    /**
     * 处理被主持人点名事件
     */
    handleBeingCalled: function() {
        this.isCalledByHost = true;
        document.getElementById('questionInput').placeholder = '你已被点名，请输入问题...';
        document.getElementById('questionInput').focus();
        
        // 显示被点名提示
        alert('你已被主持人点名，请提问');
    },
    
    /**
     * 添加消息到聊天历史
     * @param {Object} message - 消息对象
     */
    appendToChatHistory: function(message) {
        // 添加到UI
        const chatHistory = document.getElementById('participantChatHistory');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message');
        
        switch(message.type) {
            case 'question':
                messageDiv.classList.add('question-message');
                messageDiv.innerHTML = `<div class="sender">${message.sender}:</div><div class="content">${message.content}</div>`;
                break;
                
            case 'answer':
                messageDiv.classList.add('answer-message');
                messageDiv.textContent = `回答：${message.content}`;
                break;
                
            case 'clue':
                messageDiv.classList.add('clue-message');
                messageDiv.innerHTML = `<div class="sender">情报:</div><div class="content">${message.content}</div>`;
                break;
                
            case 'interaction':
                messageDiv.classList.add('interaction-message');
                messageDiv.textContent = `${message.sender} ${message.content}`;
                break;
                
            case 'system':
                messageDiv.classList.add('system-message');
                messageDiv.textContent = message.content;
                break;
        }
        
        chatHistory.appendChild(messageDiv);
        
        // 滚动到最新消息
        chatHistory.scrollTop = chatHistory.scrollHeight;
    },
    
    // 是否已被主持人点名
    isCalledByHost: false
};

// 全局导出
window.participantManager = participantManager; 