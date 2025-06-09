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
        
        // 切换到连接管理视图
        viewManager.switchTo('hostConnectionView');
    },
    
    /**
     * 处理参与者响应码，建立连接
     */
    connectParticipant: function() {
        console.log("开始处理参与者响应码");
        const responseCode = document.getElementById('participantResponseCode').value.trim();
        
        if (!responseCode) {
            alert('请输入参与者的响应码');
            return;
        }
        
        console.log("正在处理响应码...");
        // 处理响应码
        appState.peerManager.processResponseCode(responseCode)
            .then(result => {
                console.log("响应码处理成功，得到结果:", result);
                // 清空响应码输入框，准备接收下一位参与者
                document.getElementById('participantResponseCode').value = '';
                
                // 添加参与者到列表
                const participantId = result.participantId;
                const nickname = result.nickname;
                const answerCode = result.answerCode;
                
                console.log(`生成了应答码，需要回传给参与者 ${nickname}(${participantId})`);
                console.log("应答码:", answerCode);
                
                // 更新UI显示
                this.addParticipantToList(participantId, nickname);
                
                // 显示连接成功的消息
                alert(`参与者 ${nickname} 已成功连接，等待连接建立`);
                
                // 主动向参与者发送连接确认消息
                console.log("尝试主动发送连接确认消息...");
                setTimeout(() => {
                    try {
                        if (appState.peerManager.peers[participantId] && 
                            appState.peerManager.peers[participantId].connected) {
                            console.log("连接已建立，发送确认消息");
                            
                            appState.peerManager.sendToParticipant(participantId, {
                                type: 'H2A_INTERACTION_RELAY',
                                payload: {
                                    type: 'connection_confirmed',
                                    message: "主持人已确认连接"
                                }
                            });
                        } else {
                            console.log("连接尚未建立，不能发送消息");
                        }
                    } catch (e) {
                        console.error("发送确认消息失败", e);
                    }
                }, 2000);
            })
            .catch(error => {
                console.error("处理响应码失败:", error);
                alert('处理响应码失败: ' + error);
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
        document.getElementById('hostGameTitle').textContent = appState.gameInfo.title;
        document.getElementById('hostSolutionDisplay').textContent = `汤底: ${appState.gameInfo.solution}`;
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
        document.getElementById('endGameTitle').textContent = appState.gameInfo.title;
        document.getElementById('endGameSolution').textContent = appState.gameInfo.solution;
        viewManager.switchTo('gameEndView');
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
    }
};

// 全局导出
window.hostManager = hostManager;
