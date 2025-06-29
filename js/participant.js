/**
 * P2P海龟汤在线房间 - 参与者功能模块
 * 负责处理参与者加入房间、提问和互动等功能
 */

const participantManager = {
    /**
     * 加入游戏
     * @param {string} nickname - 参与者昵称
     * @param {string} inviteCode - 邀请码
     */
    joinGame: function(nickname, inviteCode) {
        console.log(`[DEBUG] joinGame开始，昵称: ${nickname}, 邀请码: ${inviteCode}`);
        appState.role = 'participant';
        appState.nickname = nickname;
        
        console.log("[DEBUG] 初始化P2P连接管理器");
        // 初始化P2P管理器
        appState.peerManager = new PeerManager(
            'participant',
            this.handlePeerMessage,
            this.handlePeerConnected,
            this.handlePeerDisconnected
        );
        
        try {
            // 验证邀请码格式
            if (!inviteCode || inviteCode.length < 5) {
                throw new Error('邀请码格式不正确');
            }
            
            // 显示加载提示
            viewManager.switchTo('participantWaitingView');
            const infoText = document.querySelector('.info-text');
            if (infoText) {
                infoText.innerHTML = '<p>正在准备连接请求，请稍候...</p>';
            }
            
            // 生成连接请求码
            appState.peerManager.generateConnectionRequest(nickname, inviteCode)
                .then(connectionRequestCode => {
                    console.log("[DEBUG] 连接请求码生成成功，长度:", connectionRequestCode.length);
                    
                    // 保存连接请求码到隐藏字段（用于手动连接备用）
                    document.getElementById('responseCode').value = connectionRequestCode;
                    
                    // 显示连接请求码和说明
                    this._showConnectionRequestCode(connectionRequestCode);
                    
                    // 预先加载游戏信息（从本地存储）
                    this._preloadGameInfo(inviteCode);
                })
                .catch(error => {
                    console.error("[DEBUG] 生成连接请求码失败:", error);
                    this._showDiagnosticInfo(inviteCode, error);
                });
        } catch (error) {
            console.error("[参与者] 加入游戏失败:", error);
            this._showDiagnosticInfo(inviteCode, error);
        }
    },
    
    /**
     * 显示连接请求码
     * @param {string} connectionRequestCode - 连接请求码
     * @private
     */
    _showConnectionRequestCode: function(connectionRequestCode) {
        // 切换到等待连接视图
        viewManager.switchTo('participantWaitingView');
        
        // 显示连接请求码
        const connectionInfo = document.querySelector('.connection-info');
        if (connectionInfo) {
            connectionInfo.style.display = 'block';
        }
        
        // 更新等待连接提示
        const infoText = document.querySelector('.info-text');
        if (infoText) {
            infoText.innerHTML = `
                <p>请将以下连接请求码提供给主持人：</p>
                <ol>
                    <li>复制连接请求码</li>
                    <li>发送给主持人</li>
                    <li>等待主持人接受连接</li>
                </ol>
                <p>主持人接受连接后，你将收到连接响应码</p>
                <div class="connection-response-input" style="margin-top: 20px;">
                    <h4>输入主持人提供的连接响应码：</h4>
                    <textarea id="connectionResponseInput" placeholder="粘贴主持人提供的连接响应码..."></textarea>
                    <button id="processResponseBtn" class="btn btn-primary">处理响应</button>
                </div>
            `;
            
            // 绑定处理响应按钮事件
            setTimeout(() => {
                const processResponseBtn = document.getElementById('processResponseBtn');
                if (processResponseBtn) {
                    processResponseBtn.addEventListener('click', () => {
                        const responseCode = document.getElementById('connectionResponseInput').value.trim();
                        if (!responseCode) {
                            alert('请输入连接响应码');
                            return;
                        }
                        
                        this._processConnectionResponse(responseCode);
                    });
                }
            }, 100);
        }
    },
    
    /**
     * 处理连接响应
     * @param {string} connectionResponseCode - 连接响应码
     * @private
     */
    _processConnectionResponse: function(connectionResponseCode) {
        console.log("[DEBUG] 开始处理连接响应码");
        
        // 更新等待连接提示
        const infoText = document.querySelector('.info-text');
        if (infoText) {
            infoText.innerHTML = '<p>正在处理连接响应，请稍候...</p>';
        }
        
        // 处理连接响应
        appState.peerManager.processConnectionResponse(connectionResponseCode)
            .then(result => {
                console.log("[DEBUG] 连接响应处理成功:", result);
                
                // 显示应答码
                const { hostId, answerCode } = result;
                
                // 更新等待连接提示
                if (infoText) {
                    infoText.innerHTML = `
                        <p>请将以下应答码提供给主持人以完成连接：</p>
                        <div class="code-container" style="margin: 15px 0;">
                            <textarea id="answerCodeDisplay" readonly style="height: 100px;">${answerCode}</textarea>
                            <button id="copyAnswerCodeBtn" class="btn btn-small">复制</button>
                        </div>
                        <p>主持人处理应答码后，连接将自动建立</p>
                        <div class="loading-indicator">
                            <div class="spinner"></div>
                            <p>等待连接建立...</p>
                        </div>
                    `;
                    
                    // 绑定复制按钮事件
                    setTimeout(() => {
                        const copyBtn = document.getElementById('copyAnswerCodeBtn');
                        if (copyBtn) {
                            copyBtn.addEventListener('click', () => {
                                const textarea = document.getElementById('answerCodeDisplay');
                                textarea.select();
                                document.execCommand('copy');
                                
                                copyBtn.textContent = '已复制!';
                                setTimeout(() => {
                                    copyBtn.textContent = '复制';
                                }, 1500);
                            });
                        }
                    }, 100);
                }
            })
            .catch(error => {
                console.error("[DEBUG] 处理连接响应失败:", error);
                
                // 显示错误信息
                if (infoText) {
                    infoText.innerHTML = `
                        <p style="color: #e74c3c;">处理连接响应失败: ${error.message}</p>
                        <button id="backToRequestBtn" class="btn btn-secondary">返回</button>
                    `;
                    
                    // 绑定返回按钮事件
                    setTimeout(() => {
                        const backBtn = document.getElementById('backToRequestBtn');
                        if (backBtn) {
                            backBtn.addEventListener('click', () => {
                                // 重新显示连接请求码
                                this._showConnectionRequestCode(document.getElementById('responseCode').value);
                            });
                        }
                    }, 100);
                }
            });
    },
    
    /**
     * 预加载游戏信息
     * @param {string} inviteCode - 邀请码
     * @private
     */
    _preloadGameInfo: function(inviteCode) {
        try {
            const formattedCode = inviteCode.trim().toUpperCase();
            const shortCodeKey = `room_${formattedCode}`;
            const storedData = localStorage.getItem(shortCodeKey);
            
            if (storedData) {
                const inviteData = JSON.parse(decodeURIComponent(storedData));
                if (inviteData && inviteData.roomSettings) {
                    // 保存游戏信息
                    appState.gameInfo.title = inviteData.roomSettings.title || '';
                    appState.gameInfo.rules = inviteData.roomSettings.rules || {
                        soupType: 'red',
                        questionMode: 'free',
                        interactionMode: 'allow'
                    };
                    console.log("[DEBUG] 已预加载游戏信息");
                }
            }
        } catch (error) {
            console.error("[DEBUG] 预加载游戏信息失败:", error);
        }
    },
    
    /**
     * 显示诊断信息
     * @param {string} inviteCode - 邀请码
     * @param {Error} error - 错误对象
     * @private
     */
    _showDiagnosticInfo: function(inviteCode, error) {
        console.log("[DEBUG] 显示邀请码诊断信息");
        
        // 获取邀请码有效性检查结果
        const validityCheck = PeerManager.checkInviteCodeValidity(inviteCode);
        console.log("[DEBUG] 邀请码有效性检查结果:", validityCheck);
        
        // 创建诊断信息HTML
        let diagnosticHtml = `
            <div class="diagnostic-info">
                <h3>邀请码解析失败</h3>
                <p class="error-message">${error.message}</p>
                
                <div class="diagnostic-details">
                    <h4>诊断信息</h4>
                    <p>邀请码: <strong>${inviteCode}</strong></p>
                    <p>有效性: <strong>${validityCheck.isValid ? '有效' : '无效'}</strong></p>
                    
                    <h4>存储状态检查</h4>
                    <ul>
                        <li>本地存储 (localStorage): ${validityCheck.diagnostics.localStorage ? '✅ 找到数据' : '❌ 未找到数据'}</li>
                        <li>会话存储 (sessionStorage): ${validityCheck.diagnostics.sessionStorage ? '✅ 找到数据' : '❌ 未找到数据'}</li>
                        <li>URL参数: ${validityCheck.diagnostics.urlParams ? '✅ 找到数据' : '❌ 未找到数据'}</li>
                    </ul>
                    
                    <h4>浏览器存储权限</h4>
                    <ul>
                        <li>localStorage: ${validityCheck.diagnostics.details.storageAvailable.localStorage ? '✅ 可用' : '❌ 不可用'}</li>
                        <li>sessionStorage: ${validityCheck.diagnostics.details.storageAvailable.sessionStorage ? '✅ 可用' : '❌ 不可用'}</li>
                    </ul>
                    
                    <div class="resolution-tips">
                        <h4>可能的解决方法:</h4>
                        <ul>
                            <li>确认邀请码输入正确（区分大小写）</li>
                            <li>请主持人重新生成并分享邀请码</li>
                            <li>尝试使用主持人分享的链接直接加入</li>
                            <li>检查浏览器是否阻止了存储访问（隐私模式等）</li>
                            <li>确保主持人和参与者使用相同的网络环境</li>
                        </ul>
                    </div>
                </div>
                
                <button id="backToJoinBtn" class="btn btn-primary">返回</button>
            </div>
        `;
        
        // 显示诊断信息
        viewManager.switchTo('participantJoinView');
        
        // 添加诊断信息到页面
        const joinView = document.getElementById('participantJoinView');
        const originalContent = joinView.innerHTML;
        joinView.innerHTML = diagnosticHtml;
        
        // 绑定返回按钮事件
        document.getElementById('backToJoinBtn').addEventListener('click', () => {
            joinView.innerHTML = originalContent;
            
            // 重新绑定事件
            document.getElementById('joinGameBtn').addEventListener('click', () => {
                const nickname = document.getElementById('participantName').value.trim();
                const inviteCode = document.getElementById('inviteCode').value.trim();
                
                if (!nickname) {
                    alert('请输入你的昵称');
                    return;
                }
                
                if (!inviteCode) {
                    alert('请输入主持人分享的邀请码');
                    return;
                }
                
                this.joinGame(nickname, inviteCode);
            });
            
            document.getElementById('backFromJoinBtn').addEventListener('click', () => {
                viewManager.switchTo('welcomeView');
            });
            
            // 保留之前输入的值
            document.getElementById('participantName').value = appState.nickname;
            document.getElementById('inviteCode').value = inviteCode;
        });
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
                
            case 'H2A_GAME_STATE': // 游戏状态
                console.log("[DEBUG] 收到游戏状态更新:", message.payload);
                
                // 更新游戏信息
                appState.gameInfo.title = message.payload.title;
                appState.gameInfo.rules = message.payload.rules;
                
                // 检查是否是新的汤
                const isNewSoup = message.payload.newSoup === true;
                
                // 更新UI显示
                document.getElementById('participantGameTitle').innerHTML = message.payload.title.replace(/\n/g, '<br>');
                
                // 显示汤的类型
                const soupTypeElement = document.getElementById('participantSoupType');
                if (soupTypeElement) {
                    soupTypeElement.textContent = message.payload.rules.soupType === 'red' ? '红汤' : '非红汤';
                    soupTypeElement.className = 'soup-type-display ' + 
                        (message.payload.rules.soupType === 'red' ? 'red-soup' : 'other-soup');
                }
                
                // 更新参与者列表
                if (message.payload.participants && message.payload.participants.length > 0) {
                    const participantsList = document.getElementById('participantViewList');
                    const participantCount = document.getElementById('participantViewCount');
                    
                    participantsList.innerHTML = '';
                    message.payload.participants.forEach(nickname => {
                        const li = document.createElement('li');
                        li.textContent = nickname;
                        participantsList.appendChild(li);
                    });
                    
                    participantCount.textContent = message.payload.participants.length;
                }
                
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
                
                // 如果是新汤，添加分隔线和新汤面通知
                if (isNewSoup) {
                    console.log("[DEBUG] 处理新汤...");
                    
                    // 添加分隔消息
                    participantManager.appendToChatHistory({
                        type: 'system',
                        content: '===== 新的海龟汤开始 ====='
                    });
                    
                    // 添加新汤面公告
                    participantManager.appendToChatHistory({
                        type: 'system',
                        content: `新的汤面：${message.payload.title}`
                    });
                }
                // 如果有聊天历史且不是新汤，加载历史消息
                else if (message.payload.history && message.payload.history.length > 0) {
                    console.log("[DEBUG] 加载历史消息, 数量:", message.payload.history.length);
                    
                    // 清空现有的聊天历史显示，避免重复
                    const chatHistory = document.getElementById('participantChatHistory');
                    if (chatHistory) {
                        chatHistory.innerHTML = '';
                    }
                    
                    // 加载服务器发送的聊天历史记录
                    message.payload.history.forEach(msg => {
                        participantManager.appendToChatHistory(msg);
                    });
                }
                
                console.log("[DEBUG] 切换到游戏视图");
                // 切换到游戏视图
                viewManager.switchTo('participantGameView');
                
                // 发送确认消息
                try {
                    console.log("[DEBUG] 发送游戏状态接收确认");
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
                    console.error("[DEBUG] 发送确认消息失败", e);
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
                else if (message.payload.type === 'participant_joined') {
                    // 处理新参与者加入的消息
                    participantManager.appendToChatHistory({
                        type: 'system',
                        content: message.payload.message
                    });
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
                document.getElementById('endGameTitle').innerHTML = appState.gameInfo.title.replace(/\n/g, '<br>');
                document.getElementById('endGameSolution').innerHTML = message.payload.solution.replace(/\n/g, '<br>');
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