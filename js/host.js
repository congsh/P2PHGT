/**
 * P2P海龟汤在线房间 - 主持人功能模块
 * 负责处理主持人的创建房间、连接管理和游戏控制
 */

const hostManager = {
    /**
     * 创建新游戏并生成邀请码
     */
    createGame: function() {
        // 获取汤面和汤底
        const soupTitle = document.getElementById('soupTitle').value.trim();
        const soupSolution = document.getElementById('soupSolution').value.trim();
        
        // 验证必填字段
        if (!soupTitle || !soupSolution) {
            alert('请填写汤面和汤底');
            return;
        }
        
        // 获取游戏规则
        const soupType = document.querySelector('input[name="soupType"]:checked').value;
        const questionMode = document.querySelector('input[name="questionMode"]:checked').value;
        const interactionMode = document.querySelector('input[name="interactionMode"]:checked').value;
        
        // 保存游戏信息
        appState.role = 'host';
        appState.gameInfo.title = soupTitle;
        appState.gameInfo.solution = soupSolution;
        appState.gameInfo.rules = {
            soupType,
            questionMode,
            interactionMode
        };
        
        // 初始化P2P管理器
        appState.peerManager = new PeerManager(
            'host',
            this.handlePeerMessage,
            this.handlePeerConnected,
            this.handlePeerDisconnected
        );
        
        // 生成邀请码
        const roomSettings = {
            title: soupTitle,
            rules: appState.gameInfo.rules
        };
        const inviteCode = appState.peerManager.generateInviteCode(roomSettings);
        
        // 显示邀请码
        document.getElementById('hostInviteCode').value = inviteCode;
        
        // 生成并显示分享链接
        const shareUrl = appState.peerManager.shareRoomInfo(inviteCode);
        if (shareUrl) {
            document.getElementById('shareUrl').value = shareUrl;
            document.getElementById('shareUrlContainer').style.display = 'block';
        }
        
        // 切换到连接管理视图
        viewManager.switchTo('hostConnectionView');
    },
    
    /**
     * 复制分享链接到剪贴板
     */
    copyShareUrl: function() {
        const shareUrlInput = document.getElementById('shareUrl');
        shareUrlInput.select();
        document.execCommand('copy');
        alert('分享链接已复制到剪贴板');
    },
    
    /**
     * 处理参与者连接请求
     */
    connectParticipant: function() {
        console.log("[主持人] 开始处理参与者连接请求");
        const connectionRequestCode = document.getElementById('participantResponseCode').value.trim();
        
        if (!connectionRequestCode) {
            alert('请输入参与者的连接请求码');
            return;
        }
        
        // 显示处理状态
        const statusText = document.querySelector('.connection-input .status-text');
        if (statusText) {
            statusText.textContent = "正在处理连接请求...";
        }
        
        // 处理连接请求
        appState.peerManager.processConnectionRequest(connectionRequestCode)
            .then(result => {
                console.log("[主持人] 连接请求处理成功:", result);
                const { participantId, nickname, connectionResponseCode } = result;
                
                // 清空请求码输入框
                document.getElementById('participantResponseCode').value = '';
                
                // 显示连接响应码
                const responseContainer = document.querySelector('.connection-response');
                if (responseContainer) {
                    responseContainer.style.display = 'block';
                    const responseCodeElem = document.getElementById('connectionResponseCode');
                    if (responseCodeElem) {
                        responseCodeElem.value = connectionResponseCode;
                        
                        // 自动选中以便复制
                        responseCodeElem.select();
                    }
                    
                    // 更新状态文本
                    if (statusText) {
                        statusText.textContent = `请将连接响应码发送给参与者: ${nickname}`;
                    }
                    
                    // 显示应答码输入区域
                    const answerContainer = document.querySelector('.connection-answer');
                    if (answerContainer) {
                        answerContainer.style.display = 'block';
                        answerContainer.dataset.participantId = participantId;
                        answerContainer.dataset.nickname = nickname;
                    }
                }
            })
            .catch(error => {
                console.error("[主持人] 处理连接请求失败:", error);
                alert('处理连接请求失败: ' + error.message);
                
                // 更新状态文本
                if (statusText) {
                    statusText.textContent = "处理失败，请重试";
                }
            });
    },
    
    /**
     * 完成连接
     */
    finalizeConnection: function() {
        console.log("[主持人] 开始完成连接");
        const answerCode = document.getElementById('answerCodeInput').value.trim();
        
        if (!answerCode) {
            alert('请输入参与者的应答码');
            return;
        }
        
        // 显示处理状态
        const statusText = document.querySelector('.connection-answer .status-text');
        if (statusText) {
            statusText.textContent = "正在完成连接...";
        }
        
        // 完成连接
        appState.peerManager.finalizeConnection(answerCode)
            .then(result => {
                console.log("[主持人] 连接完成:", result);
                
                // 清空应答码输入框
                document.getElementById('answerCodeInput').value = '';
                
                // 隐藏连接响应和应答区域
                const responseContainer = document.querySelector('.connection-response');
                if (responseContainer) {
                    responseContainer.style.display = 'none';
                }
                
                const answerContainer = document.querySelector('.connection-answer');
                if (answerContainer) {
                    const participantId = answerContainer.dataset.participantId;
                    const nickname = answerContainer.dataset.nickname;
                    
                    // 添加参与者到列表
                    this.addParticipantToList(participantId, nickname);
                    
                    // 隐藏应答区域
                    answerContainer.style.display = 'none';
                    
                    // 更新状态文本
                    if (statusText) {
                        statusText.textContent = `参与者 ${nickname} 已成功连接`;
                        
                        // 3秒后恢复默认状态
                        setTimeout(() => {
                            statusText.textContent = "";
                        }, 3000);
                    }
                }
            })
            .catch(error => {
                console.error("[主持人] 完成连接失败:", error);
                alert('完成连接失败: ' + error.message);
                
                // 更新状态文本
                if (statusText) {
                    statusText.textContent = "连接失败，请重试";
                }
            });
    },
    
    /**
     * 开始游戏
     */
    startGame: function() {
        const connectedPeers = appState.peerManager.getConnectedPeers();
        
        if (connectedPeers.length === 0) {
            alert('至少需要一位参与者才能开始游戏');
            return;
        }
        
        // 准备游戏状态信息
        const gameState = {
            title: appState.gameInfo.title,
            rules: appState.gameInfo.rules,
            participants: connectedPeers.map(p => p.nickname)
        };
        
        // 向所有参与者发送游戏开始信息
        appState.peerManager.sendToParticipant(null, {
            type: 'H2A_GAME_STATE',
            payload: gameState
        });
        
        // 更新UI
        document.getElementById('hostGameTitle').innerHTML = appState.gameInfo.title.replace(/\n/g, '<br>');
        document.getElementById('hostSolutionDisplay').innerHTML = appState.gameInfo.solution.replace(/\n/g, '<br>');
        document.getElementById('participantsCount').textContent = connectedPeers.length;
        
        // 显示参与者列表
        const participantsList = document.getElementById('gameParticipantsList');
        participantsList.innerHTML = '';
        connectedPeers.forEach(peer => {
            const li = document.createElement('li');
            li.textContent = peer.nickname;
            participantsList.appendChild(li);
        });
        
        // 根据提问模式显示或隐藏举手列表
        const raiseHandList = document.getElementById('raiseHandList');
        if (appState.gameInfo.rules.questionMode === 'raiseHand') {
            raiseHandList.style.display = 'block';
        } else {
            raiseHandList.style.display = 'none';
        }
        
        // 切换到游戏主界面
        viewManager.switchTo('hostGameView');
    },
    
    /**
     * 发送情报
     */
    sendClue: function() {
        const clueInput = document.getElementById('clueInput');
        const clueContent = clueInput.value.trim();
        
        if (!clueContent) {
            alert('请输入情报内容');
            return;
        }
        
        // 创建情报消息
        const clueMessage = {
            type: 'H2A_CLUE',
            payload: { content: clueContent }
        };
        
        // 发送给所有参与者
        appState.peerManager.sendToParticipant(null, clueMessage);
        
        // 添加到本地聊天历史
        this.appendToChatHistory({
            type: 'clue',
            sender: '主持人',
            content: clueContent
        });
        
        // 清空输入框
        clueInput.value = '';
    },
    
    /**
     * 发送回答
     * @param {string} answer - 回答类型: 'yes', 'no', 'uncertain'
     */
    sendAnswer: function(answer) {
        // 创建回答消息
        const answerMessage = {
            type: 'H2A_ANSWER',
            payload: { answer }
        };
        
        // 发送给所有参与者
        appState.peerManager.sendToParticipant(null, answerMessage);
        
        // 添加到本地聊天历史
        let answerText;
        switch(answer) {
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
        
        this.appendToChatHistory({
            type: 'answer',
            content: answerText
        });
    },
    
    /**
     * 结束游戏
     */
    endGame: function() {
        if (!confirm('确定要结束游戏并公布答案吗？')) {
            return;
        }
        
        // 发送游戏结束消息
        appState.peerManager.sendToParticipant(null, {
            type: 'H2A_GAME_END',
            payload: { solution: appState.gameInfo.solution }
        });
        
        // 显示结束游戏界面
        document.getElementById('endGameTitle').innerHTML = appState.gameInfo.title.replace(/\n/g, '<br>');
        document.getElementById('endGameSolution').innerHTML = appState.gameInfo.solution.replace(/\n/g, '<br>');
        viewManager.switchTo('gameEndView');
    },
    
    /**
     * 显示继续游戏弹窗
     */
    showContinueGamePopup: function() {
        const popup = document.getElementById('continueGamePopup');
        if (popup) {
            // 清空输入框
            document.getElementById('newSoupTitle').value = '';
            document.getElementById('newSoupSolution').value = '';
            document.getElementById('newRedSoup').checked = true;
            
            // 显示弹窗
            popup.style.display = 'block';
            
            // 绑定关闭按钮事件
            const closeBtn = popup.querySelector('.close-popup');
            if (closeBtn) {
                closeBtn.onclick = function() {
                    popup.style.display = 'none';
                };
            }
            
            // 绑定取消按钮事件
            const cancelBtn = document.getElementById('cancelNewSoupBtn');
            if (cancelBtn) {
                cancelBtn.onclick = function() {
                    popup.style.display = 'none';
                };
            }
            
            // 绑定开始新汤按钮事件
            const startBtn = document.getElementById('startNewSoupBtn');
            if (startBtn) {
                startBtn.onclick = function() {
                    hostManager.continueGame();
                };
            }
            
            // 点击弹窗外部区域关闭
            window.onclick = function(event) {
                if (event.target === popup) {
                    popup.style.display = 'none';
                }
            };
        }
    },
    
    /**
     * 继续游戏，使用新的汤底汤面
     */
    continueGame: function() {
        // 获取新汤面和汤底
        const newSoupTitle = document.getElementById('newSoupTitle').value.trim();
        const newSoupSolution = document.getElementById('newSoupSolution').value.trim();
        
        // 验证必填字段
        if (!newSoupTitle || !newSoupSolution) {
            alert('请填写新的汤面和汤底');
            return;
        }
        
        // 获取汤底类型
        const newSoupType = document.querySelector('input[name="newSoupType"]:checked').value;
        
        // 保存原来的聊天历史
        const oldChatHistory = [...appState.chatHistory];
        
        // 添加分隔消息
        const separatorMessage = {
            type: 'system',
            content: '===== 新的海龟汤开始 ====='
        };
        
        // 添加到聊天历史
        this.appendToChatHistory(separatorMessage);
        
        // 添加新汤面公告
        const newSoupMessage = {
            type: 'system',
            content: `新的汤面：${newSoupTitle}`
        };
        
        // 添加到聊天历史
        this.appendToChatHistory(newSoupMessage);
        
        // 更新游戏信息
        appState.gameInfo.title = newSoupTitle;
        appState.gameInfo.solution = newSoupSolution;
        appState.gameInfo.rules.soupType = newSoupType;
        
        // 更新UI
        document.getElementById('hostGameTitle').innerHTML = newSoupTitle.replace(/\n/g, '<br>');
        document.getElementById('hostSolutionDisplay').innerHTML = newSoupSolution.replace(/\n/g, '<br>');
        
        // 向所有参与者发送新的游戏状态
        const connectedPeers = appState.peerManager.getConnectedPeers();
        
        // 过滤聊天历史，只保留主要消息
        const gameState = {
            title: newSoupTitle,
            rules: appState.gameInfo.rules,
            participants: connectedPeers.map(p => p.nickname),
            newSoup: true  // 标记这是一个新的汤
        };
        
        // 向所有参与者发送游戏状态
        appState.peerManager.sendToParticipant(null, {
            type: 'H2A_GAME_STATE',
            payload: gameState
        });
        
        // 关闭弹窗
        document.getElementById('continueGamePopup').style.display = 'none';
    },
    
    /**
     * 处理收到的参与者消息
     * @param {Object} message - 消息对象
     * @param {string} senderId - 发送者ID
     * @param {string} senderName - 发送者昵称
     */
    handlePeerMessage: function(message, senderId, senderName) {
        switch(message.type) {
            case 'C2H_QUESTION': // 参与者提问
                // 将问题转发给所有参与者
                appState.peerManager.sendToParticipant(null, {
                    type: 'H2A_QUESTION_RELAY',
                    payload: {
                        from: senderName,
                        content: message.payload.content
                    }
                });
                
                // 添加到聊天历史
                hostManager.appendToChatHistory({
                    type: 'question',
                    sender: senderName,
                    content: message.payload.content
                });
                break;
                
            case 'C2H_INTERACTION': // 参与者互动
                // 如果互动功能已禁用，则忽略
                if (appState.gameInfo.rules.interactionMode === 'disallow') {
                    return;
                }
                
                if (message.payload.type === 'raise_hand') {
                    // 处理举手
                    if (appState.gameInfo.rules.questionMode === 'raiseHand') {
                        // 添加到举手列表
                        hostManager.addToRaiseHandList(senderId, senderName);
                        
                        // 转发给所有参与者
                        appState.peerManager.sendToParticipant(null, {
                            type: 'H2A_INTERACTION_RELAY',
                            payload: {
                                from: senderName,
                                type: 'raise_hand'
                            }
                        });
                    }
                } 
                else if (message.payload.type === 'throw_flower' || message.payload.type === 'throw_trash') {
                    // 转发互动事件
                    appState.peerManager.sendToParticipant(null, {
                        type: 'H2A_INTERACTION_RELAY',
                        payload: {
                            from: senderName,
                            type: message.payload.type
                        }
                    });
                    
                    // 添加互动消息到聊天历史
                    let actionText = message.payload.type === 'throw_flower' ? '送出了一朵花' : '扔出了垃圾';
                    hostManager.appendToChatHistory({
                        type: 'interaction',
                        sender: senderName,
                        content: actionText
                    });
                }
                else if (message.payload.type === 'connection_test') {
                    // 处理连接测试消息
                    console.log("收到参与者的连接测试消息:", senderId, senderName);
                    
                    // 如果游戏尚未开始，发送一个应答消息确认连接
                    if (appState.currentView === 'hostConnectionView') {
                        console.log("发送连接测试应答");
                        
                        // 向参与者发送应答
                        appState.peerManager.sendToParticipant(senderId, {
                            type: 'H2A_INTERACTION_RELAY',
                            payload: {
                                type: 'connection_test_response',
                                message: "连接已确认"
                            }
                        });
                    }
                    // 如果游戏已开始，则向该参与者发送游戏状态
                    else if (appState.currentView === 'hostGameView') {
                        console.log("游戏已开始，向新参与者发送游戏状态");
                        
                        const connectedPeers = appState.peerManager.getConnectedPeers();
                        const gameState = {
                            title: appState.gameInfo.title,
                            rules: appState.gameInfo.rules,
                            participants: connectedPeers.map(p => p.nickname),
                            history: appState.chatHistory
                        };
                        
                        // 向该参与者发送游戏状态
                        appState.peerManager.sendToParticipant(senderId, {
                            type: 'H2A_GAME_STATE',
                            payload: gameState
                        });
                    }
                }
                break;
        }
    },
    
    /**
     * 处理参与者连接成功事件
     * @param {string} peerId - 参与者ID
     * @param {string} nickname - 参与者昵称
     */
    handlePeerConnected: function(peerId, nickname) {
        // 如果游戏已经开始，向新加入的参与者发送当前游戏状态
        if (appState.currentView === 'hostGameView') {
            const connectedPeers = appState.peerManager.getConnectedPeers();
            
            const gameState = {
                title: appState.gameInfo.title,
                rules: appState.gameInfo.rules,
                participants: connectedPeers.map(p => p.nickname),
                history: appState.chatHistory
            };
            
            // 发送游戏状态
            appState.peerManager.sendToParticipant(peerId, {
                type: 'H2A_GAME_STATE',
                payload: gameState
            });
            
            // 更新参与者计数
            document.getElementById('participantsCount').textContent = connectedPeers.length;
            
            // 更新参与者列表
            const participantsList = document.getElementById('gameParticipantsList');
            participantsList.innerHTML = '';
            connectedPeers.forEach(peer => {
                const li = document.createElement('li');
                li.textContent = peer.nickname;
                participantsList.appendChild(li);
            });
        }
    },
    
    /**
     * 处理参与者断开连接事件
     * @param {string} peerId - 参与者ID
     * @param {string} nickname - 参与者昵称
     */
    handlePeerDisconnected: function(peerId, nickname) {
        // 从列表中移除断开连接的参与者
        const listItems = document.querySelectorAll(`li[data-peer-id="${peerId}"]`);
        listItems.forEach(item => item.remove());
        
        // 如果在举手列表中，也移除
        hostManager.removeFromRaiseHandList(peerId);
        
        // 如果在游戏中，更新参与者计数
        if (appState.currentView === 'hostGameView') {
            const connectedPeers = appState.peerManager.getConnectedPeers();
            document.getElementById('participantsCount').textContent = connectedPeers.length;
        }
        
        // 通知其他参与者有人断开连接
        appState.peerManager.sendToParticipant(null, {
            type: 'H2A_INTERACTION_RELAY',
            payload: {
                from: nickname,
                type: 'disconnect'
            }
        });
    },
    
    /**
     * 将参与者添加到连接列表
     * @param {string} participantId - 参与者ID
     * @param {string} nickname - 参与者昵称
     */
    addParticipantToList: function(participantId, nickname) {
        const participantsList = document.getElementById('connectedParticipants');
        const li = document.createElement('li');
        li.textContent = nickname;
        li.setAttribute('data-peer-id', participantId);
        participantsList.appendChild(li);
        
        // 更新应用状态中的参与者列表
        appState.gameInfo.participants.push({ id: participantId, nickname });
    },
    
    /**
     * 添加消息到聊天历史
     * @param {Object} message - 消息对象
     */
    appendToChatHistory: function(message) {
        // 添加到应用状态
        appState.chatHistory.push(message);
        
        // 添加到UI
        const chatHistory = document.getElementById('chatHistory');
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
        }
        
        chatHistory.appendChild(messageDiv);
        
        // 滚动到最新消息
        chatHistory.scrollTop = chatHistory.scrollHeight;
    },
    
    /**
     * 添加参与者到举手列表
     * @param {string} participantId - 参与者ID
     * @param {string} nickname - 参与者昵称
     */
    addToRaiseHandList: function(participantId, nickname) {
        // 检查是否已经在列表中
        const existingHand = appState.handRaisedList.find(h => h.id === participantId);
        if (existingHand) return;
        
        // 添加到应用状态
        appState.handRaisedList.push({ id: participantId, nickname });
        
        // 添加到UI
        const handsList = document.getElementById('handsRaisedList');
        const li = document.createElement('li');
        li.setAttribute('data-peer-id', participantId);
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = nickname;
        
        const callBtn = document.createElement('button');
        callBtn.textContent = '点名';
        callBtn.addEventListener('click', () => {
            // 发送点名消息
            appState.peerManager.sendToParticipant(null, {
                type: 'H2A_INTERACTION_RELAY',
                payload: {
                    type: 'call_participant',
                    participantId,
                    nickname
                }
            });
            
            // 从举手列表中移除
            hostManager.removeFromRaiseHandList(participantId);
        });
        
        li.appendChild(nameSpan);
        li.appendChild(callBtn);
        handsList.appendChild(li);
    },
    
    /**
     * 从举手列表中移除参与者
     * @param {string} participantId - 参与者ID
     */
    removeFromRaiseHandList: function(participantId) {
        // 从应用状态移除
        appState.handRaisedList = appState.handRaisedList.filter(h => h.id !== participantId);
        
        // 从UI移除
        const handItem = document.querySelector(`#handsRaisedList li[data-peer-id="${participantId}"]`);
        if (handItem) {
            handItem.remove();
        }
    },
    
    /**
     * 自动检测并连接等待中的参与者
     */
    autoDetectParticipants: function() {
        console.log("[主持人] 开始自动检测等待连接的参与者");
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = "正在检测新参与者...";
        }
        
        // 从共享存储区域读取等待的响应码
        const waitingResponseKey = 'webrtc_waiting_responses';
        let waitingResponses = [];
        try {
            const storedResponses = localStorage.getItem(waitingResponseKey);
            if (storedResponses) {
                waitingResponses = JSON.parse(decodeURIComponent(storedResponses));
            }
        } catch (e) {
            console.error("[主持人] 读取等待响应失败:", e);
            if (statusText) {
                statusText.textContent = "检测失败，请稍后再试";
                setTimeout(() => {
                    statusText.textContent = "点击上方按钮自动连接新参与者";
                }, 3000);
            }
            return;
        }
        
        if (waitingResponses.length === 0) {
            console.log("[主持人] 没有找到等待连接的参与者");
            if (statusText) {
                statusText.textContent = "没有找到等待连接的参与者";
                setTimeout(() => {
                    statusText.textContent = "点击上方按钮自动连接新参与者";
                }, 3000);
            }
            return;
        }
        
        console.log(`[主持人] 找到 ${waitingResponses.length} 个等待连接的参与者`);
        
        // 创建一个副本，用于跟踪已处理的响应
        const processedIndices = [];
        
        // 处理响应码并建立连接
        const processNextResponse = (index) => {
            if (index >= waitingResponses.length) {
                // 所有响应都已处理
                // 仅从存储中移除已处理的响应
                if (processedIndices.length > 0) {
                    // 获取最新的等待响应列表（可能有新的加入）
                    try {
                        let currentResponses = [];
                        const currentStoredResponses = localStorage.getItem(waitingResponseKey);
                        if (currentStoredResponses) {
                            currentResponses = JSON.parse(decodeURIComponent(currentStoredResponses));
                        }
                        
                        // 过滤掉已处理的响应
                        const remainingResponses = currentResponses.filter((_, i) => !processedIndices.includes(i));
                        localStorage.setItem(waitingResponseKey, encodeURIComponent(JSON.stringify(remainingResponses)));
                        console.log(`[主持人] 已处理 ${processedIndices.length} 个连接，剩余 ${remainingResponses.length} 个等待处理`);
                    } catch (e) {
                        console.error("[主持人] 更新等待响应失败:", e);
                    }
                }
                
                if (statusText) {
                    statusText.textContent = `已连接所有参与者 (${processedIndices.length}人)`;
                    setTimeout(() => {
                        statusText.textContent = "点击上方按钮自动连接新参与者";
                    }, 3000);
                }
                return;
            }
            
            const response = waitingResponses[index];
            console.log(`[主持人] 正在处理第 ${index + 1} 个参与者: ${response.nickname}`);
            
            // 处理当前响应
            appState.peerManager.processResponseCode(response.responseCode)
                .then(result => {
                    console.log(`[主持人] 参与者 ${response.nickname} 连接处理成功`);
                    
                    // 添加到UI列表
                    this.addParticipantToList(result.participantId, result.nickname);
                    
                    // 记录已处理的索引
                    processedIndices.push(index);
                    
                    // 更新状态文本
                    if (statusText) {
                        statusText.textContent = `已连接: ${response.nickname} (${processedIndices.length}/${waitingResponses.length})`;
                    }
                    
                    // 继续处理下一个
                    setTimeout(() => {
                        processNextResponse(index + 1);
                    }, 500);
                })
                .catch(error => {
                    console.error(`[主持人] 处理参与者 ${response.nickname} 响应失败:`, error);
                    
                    // 继续处理下一个
                    setTimeout(() => {
                        processNextResponse(index + 1);
                    }, 500);
                });
        };
        
        // 开始处理第一个响应
        processNextResponse(0);
    },
    
    /**
     * 显示邀请弹窗
     */
    showInvitePopup: function() {
        const popup = document.getElementById('invitePopup');
        if (popup) {
            // 过滤聊天历史，只保留主要消息
            const filteredHistory = appState.chatHistory.filter(msg => {
                return msg.type === 'clue' || 
                       msg.type === 'answer' || 
                       msg.type === 'system' ||
                       msg.type === 'question';
            });
            
            // 生成新的邀请码（包含当前游戏状态）
            const roomSettings = {
                title: appState.gameInfo.title,
                rules: appState.gameInfo.rules,
                gameInProgress: true,
                // 添加当前游戏状态信息，供新参与者同步
                gameState: {
                    chatHistory: filteredHistory,
                    participants: appState.peerManager.getConnectedPeers().map(p => p.nickname)
                }
            };
            
            // 生成邀请码并显示
            const inviteCode = appState.peerManager.generateInviteCode(roomSettings);
            document.getElementById('gameInviteCode').value = inviteCode;
            
            // 显示弹窗
            popup.style.display = 'block';
            
            // 绑定关闭按钮事件
            const closeBtn = popup.querySelector('.close-popup');
            if (closeBtn) {
                closeBtn.onclick = function() {
                    popup.style.display = 'none';
                };
            }
            
            // 点击弹窗外部区域关闭
            window.onclick = function(event) {
                if (event.target === popup) {
                    popup.style.display = 'none';
                }
            };
        }
    },
    
    /**
     * 在游戏中自动检测并连接新参与者
     */
    gameAutoDetectParticipants: function() {
        console.log("[主持人] 游戏中检测新参与者");
        const statusText = document.querySelector('#invitePopup .status-text');
        if (statusText) {
            statusText.textContent = "正在检测新参与者...";
        }
        
        // 从共享存储区域读取等待的响应码
        const waitingResponseKey = 'webrtc_waiting_responses';
        let waitingResponses = [];
        try {
            const storedResponses = localStorage.getItem(waitingResponseKey);
            if (storedResponses) {
                waitingResponses = JSON.parse(decodeURIComponent(storedResponses));
            }
        } catch (e) {
            console.error("[主持人] 读取等待响应失败:", e);
            if (statusText) {
                statusText.textContent = "检测失败，请稍后再试";
                setTimeout(() => {
                    statusText.textContent = "点击上方按钮自动连接新参与者";
                }, 3000);
            }
            return;
        }
        
        if (waitingResponses.length === 0) {
            console.log("[主持人] 没有找到等待连接的参与者");
            if (statusText) {
                statusText.textContent = "没有找到等待连接的参与者";
                setTimeout(() => {
                    statusText.textContent = "点击上方按钮自动连接新参与者";
                }, 3000);
            }
            return;
        }
        
        console.log(`[主持人] 找到 ${waitingResponses.length} 个等待连接的参与者`);
        
        // 创建一个副本，用于跟踪已处理的响应
        const processedIndices = [];
        
        // 处理响应码并建立连接
        const processNextResponse = (index) => {
            if (index >= waitingResponses.length) {
                // 所有响应都已处理
                // 仅从存储中移除已处理的响应
                if (processedIndices.length > 0) {
                    // 获取最新的等待响应列表（可能有新的加入）
                    try {
                        let currentResponses = [];
                        const currentStoredResponses = localStorage.getItem(waitingResponseKey);
                        if (currentStoredResponses) {
                            currentResponses = JSON.parse(decodeURIComponent(currentStoredResponses));
                        }
                        
                        // 过滤掉已处理的响应
                        const remainingResponses = currentResponses.filter((_, i) => !processedIndices.includes(i));
                        localStorage.setItem(waitingResponseKey, encodeURIComponent(JSON.stringify(remainingResponses)));
                        console.log(`[主持人] 游戏中已处理 ${processedIndices.length} 个连接，剩余 ${remainingResponses.length} 个等待处理`);
                    } catch (e) {
                        console.error("[主持人] 更新等待响应失败:", e);
                    }
                }
                
                if (statusText) {
                    statusText.textContent = `已连接所有参与者 (${processedIndices.length}人)`;
                    setTimeout(() => {
                        statusText.textContent = "点击上方按钮自动连接新参与者";
                    }, 3000);
                }
                return;
            }
            
            const response = waitingResponses[index];
            console.log(`[主持人] 正在处理第 ${index + 1} 个参与者: ${response.nickname}`);
            
            // 处理当前响应
            appState.peerManager.processResponseCode(response.responseCode)
                .then(result => {
                    console.log(`[主持人] 参与者 ${response.nickname} 连接处理成功`);
                    
                    // 添加到UI列表
                    this.addParticipantToList(result.participantId, result.nickname);
                    this.addParticipantToGame(result.participantId, result.nickname);
                    
                    // 记录已处理的索引
                    processedIndices.push(index);
                    
                    // 向新参与者发送当前游戏状态
                    setTimeout(() => {
                        this.syncGameStateToNewParticipant(result.participantId);
                    }, 1000);
                    
                    // 更新状态文本
                    if (statusText) {
                        statusText.textContent = `已连接: ${response.nickname} (${processedIndices.length}/${waitingResponses.length})`;
                    }
                    
                    // 继续处理下一个
                    setTimeout(() => {
                        processNextResponse(index + 1);
                    }, 500);
                })
                .catch(error => {
                    console.error(`[主持人] 处理参与者 ${response.nickname} 响应失败:`, error);
                    
                    // 继续处理下一个
                    setTimeout(() => {
                        processNextResponse(index + 1);
                    }, 500);
                });
        };
        
        // 开始处理第一个响应
        processNextResponse(0);
    },
    
    /**
     * 将参与者添加到游戏中（在游戏已经开始后）
     */
    addParticipantToGame: function(participantId, nickname) {
        // 更新游戏UI显示
        const participantsList = document.getElementById('gameParticipantsList');
        const count = document.getElementById('participantsCount');
        
        // 添加到列表
        const li = document.createElement('li');
        li.textContent = nickname;
        li.setAttribute('data-id', participantId);
        participantsList.appendChild(li);
        
        // 更新计数
        count.textContent = participantsList.childElementCount;
        
        // 广播新参与者加入的消息给所有参与者
        const joinMessage = {
            type: 'H2A_INTERACTION_RELAY',
            payload: {
                type: 'participant_joined',
                nickname: nickname,
                message: `${nickname} 加入了游戏`
            }
        };
        
        appState.peerManager.sendToParticipant(null, joinMessage);
        
        // 添加到本地聊天历史
        this.appendToChatHistory({
            type: 'system',
            content: `${nickname} 加入了游戏`
        });
    },
    
    /**
     * 向新参与者同步当前游戏状态
     */
    syncGameStateToNewParticipant: function(participantId) {
        // 准备游戏状态信息
        const connectedPeers = appState.peerManager.getConnectedPeers();
        
        // 过滤聊天历史，只保留主持人消息和系统消息
        const filteredHistory = appState.chatHistory.filter(msg => {
            // 保留由主持人发送的消息（情报、回答）
            // 保留系统消息
            // 保留问题消息（因为问题通常是转发的，只有一份）
            return msg.type === 'clue' || 
                   msg.type === 'answer' || 
                   msg.type === 'system' ||
                   msg.type === 'question';
        });
        
        const gameState = {
            title: appState.gameInfo.title,
            rules: appState.gameInfo.rules,
            participants: connectedPeers.map(p => p.nickname),
            history: filteredHistory  // 发送过滤后的聊天历史
        };
        
        // 向新参与者发送游戏状态
        appState.peerManager.sendToParticipant(participantId, {
            type: 'H2A_GAME_STATE',
            payload: gameState
        });
        
        console.log(`[主持人] 已向参与者 ${participantId} 同步游戏状态, 历史消息数量: ${filteredHistory.length}`);
    }
};

// 全局导出
window.hostManager = hostManager;
