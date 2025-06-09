/**
 * P2P海龟汤在线房间 - 主程序入口
 * 负责初始化和视图切换控制
 */

// 全局应用状态
const appState = {
    currentView: 'welcomeView',
    role: null,          // 'host' 或 'participant'
    peerManager: null,   // P2P连接管理器实例
    gameInfo: {          // 游戏信息
        title: '',       // 汤面
        solution: '',    // 汤底
        rules: {         // 游戏规则
            soupType: 'red',
            questionMode: 'free',
            interactionMode: 'allow'
        },
        participants: [] // 参与者列表
    },
    nickname: '',        // 参与者昵称
    chatHistory: [],     // 聊天历史
    handRaisedList: []   // 举手列表
};

// 视图控制
const viewManager = {
    /**
     * 切换到指定视图
     * @param {string} viewId - 视图ID
     */
    switchTo: function(viewId) {
        // 隐藏所有视图
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // 显示目标视图
        document.getElementById(viewId).classList.add('active');
        appState.currentView = viewId;
    },
    
    /**
     * 初始化剪贴板功能
     */
    initClipboardFunctions: function() {
        // 为可复制文本区域添加复制功能
        const clipboardBtns = [
            { btnId: 'copyInviteCodeBtn', textareaId: 'hostInviteCode' },
            { btnId: 'copyResponseCodeBtn', textareaId: 'responseCode' },
            { btnId: 'copyShareUrlBtn', textareaId: 'shareUrl' }
        ];
        
        clipboardBtns.forEach(item => {
            const btn = document.getElementById(item.btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    const textarea = document.getElementById(item.textareaId);
                    textarea.select();
                    document.execCommand('copy');
                    
                    // 显示复制成功的临时提示
                    const originalText = btn.textContent;
                    btn.textContent = '已复制!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 1500);
                });
            }
        });
    }
};

/**
 * 初始化汤底显示/隐藏功能
 */
function initSolutionToggle() {
    const toggleBtn = document.getElementById('solutionToggle');
    const solutionDisplay = document.getElementById('hostSolutionDisplay');
    
    if (toggleBtn && solutionDisplay) {
        // 默认隐藏汤底
        solutionDisplay.style.display = 'none';
        toggleBtn.textContent = '👁';
        
        // 点击切换显示/隐藏
        toggleBtn.addEventListener('click', function() {
            if (solutionDisplay.style.display === 'none') {
                solutionDisplay.style.display = 'block';
                toggleBtn.textContent = '❌';
                toggleBtn.title = '点击隐藏汤底';
            } else {
                solutionDisplay.style.display = 'none';
                toggleBtn.textContent = '👁';
                toggleBtn.title = '点击显示汤底';
            }
        });
    }
}

// 初始化应用
function initApp() {
    // 检查URL中是否有房间邀请码
    const roomCodeFromUrl = PeerManager.checkUrlForInviteCode();
    if (roomCodeFromUrl) {
        // 如果URL中包含房间码，延迟一点执行，确保DOM已完全加载
        setTimeout(() => {
            document.getElementById('inviteCode').value = roomCodeFromUrl;
            document.getElementById('participantName').focus(); // 聚焦到昵称输入框
            viewManager.switchTo('participantJoinView');
            
            // 显示提示信息
            const infoElement = document.createElement('div');
            infoElement.className = 'info-message';
            infoElement.textContent = '已自动填写邀请码，请输入昵称并点击"加入游戏"';
            infoElement.style.color = '#2ecc71';
            infoElement.style.marginTop = '10px';
            infoElement.style.textAlign = 'center';
            
            const formGroup = document.querySelector('#participantJoinView .button-group');
            formGroup.parentNode.insertBefore(infoElement, formGroup);
            
            // 5秒后自动移除提示
            setTimeout(() => {
                if (infoElement.parentNode) {
                    infoElement.parentNode.removeChild(infoElement);
                }
            }, 5000);
        }, 300); // 增加延迟，确保DOM完全加载
    } else {
        // 检查本地存储中是否有待处理的邀请码
        const pendingCode = sessionStorage.getItem('pending_invite_code');
        const loadedRoomCode = sessionStorage.getItem('loaded_room_code');
        
        if (pendingCode || loadedRoomCode) {
            const inviteCode = loadedRoomCode || pendingCode;
            console.log(`[DEBUG] 发现本地存储的邀请码: ${inviteCode}`);
            
            // 延迟执行，确保DOM已完全加载
            setTimeout(() => {
                document.getElementById('inviteCode').value = inviteCode;
                viewManager.switchTo('participantJoinView');
            }, 300);
        }
    }
    
    // 绑定欢迎页面按钮事件
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        viewManager.switchTo('hostCreationView');
    });
    
    document.getElementById('joinRoomBtn').addEventListener('click', () => {
        viewManager.switchTo('participantJoinView');
    });
    
    // 绑定主持人创建房间页面事件
    document.getElementById('createGameBtn').addEventListener('click', () => {
        hostManager.createGame();
    });
    
    document.getElementById('backToWelcomeBtn').addEventListener('click', () => {
        viewManager.switchTo('welcomeView');
    });
    
    // 绑定参与者加入房间页面事件
    document.getElementById('joinGameBtn').addEventListener('click', () => {
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
        
        // 调用参与者管理器的加入游戏方法
        participantManager.joinGame(nickname, inviteCode);
    });
    
    document.getElementById('backFromJoinBtn').addEventListener('click', () => {
        viewManager.switchTo('welcomeView');
    });
    
    // 绑定主持人连接管理界面事件
    document.getElementById('connectParticipantBtn').addEventListener('click', () => {
        hostManager.connectParticipant();
    });
    
    document.getElementById('autoDetectBtn').addEventListener('click', () => {
        hostManager.autoDetectParticipants();
    });
    
    document.getElementById('startGameBtn').addEventListener('click', () => {
        hostManager.startGame();
    });
    
    // 绑定主持人游戏界面事件
    document.getElementById('sendClueBtn').addEventListener('click', () => {
        hostManager.sendClue();
    });
    
    document.getElementById('answerYesBtn').addEventListener('click', () => {
        hostManager.sendAnswer('yes');
    });
    
    document.getElementById('answerNoBtn').addEventListener('click', () => {
        hostManager.sendAnswer('no');
    });
    
    document.getElementById('answerUncertainBtn').addEventListener('click', () => {
        hostManager.sendAnswer('uncertain');
    });
    
    document.getElementById('endGameBtn').addEventListener('click', () => {
        hostManager.endGame();
    });
    
    // 绑定继续游戏按钮事件
    document.getElementById('continueGameBtn').addEventListener('click', () => {
        hostManager.showContinueGamePopup();
    });
    
    // 绑定邀请新参与者按钮事件
    document.getElementById('showInviteBtn').addEventListener('click', () => {
        hostManager.showInvitePopup();
    });
    
    document.getElementById('gameAutoDetectBtn').addEventListener('click', () => {
        hostManager.gameAutoDetectParticipants();
    });
    
    document.getElementById('copyGameInviteCodeBtn').addEventListener('click', () => {
        const textarea = document.getElementById('gameInviteCode');
        textarea.select();
        document.execCommand('copy');
        
        // 显示复制成功的临时提示
        const btn = document.getElementById('copyGameInviteCodeBtn');
        const originalText = btn.textContent;
        btn.textContent = '已复制!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1500);
    });
    
    // 绑定参与者游戏界面事件
    document.getElementById('sendQuestionBtn').addEventListener('click', () => {
        participantManager.sendQuestion();
    });
    
    document.getElementById('raiseHandBtn').addEventListener('click', () => {
        participantManager.raiseHand();
    });
    
    document.getElementById('throwFlowerBtn').addEventListener('click', () => {
        participantManager.sendInteraction('throw_flower');
    });
    
    document.getElementById('throwTrashBtn').addEventListener('click', () => {
        participantManager.sendInteraction('throw_trash');
    });
    
    // 绑定游戏结束界面事件
    document.getElementById('returnToWelcomeBtn').addEventListener('click', () => {
        viewManager.switchTo('welcomeView');
        resetAppState();
    });
    
    // 初始化复制功能
    viewManager.initClipboardFunctions();
    
    // 初始化汤底显示/隐藏功能
    initSolutionToggle();
}

/**
 * 重置应用状态
 */
function resetAppState() {
    // 断开现有的P2P连接
    if (appState.peerManager) {
        // 这里可以添加清理连接的代码
    }
    
    // 重置应用状态
    appState.role = null;
    appState.peerManager = null;
    appState.gameInfo = {
        title: '',
        solution: '',
        rules: {
            soupType: 'red',
            questionMode: 'free',
            interactionMode: 'allow'
        },
        participants: []
    };
    appState.nickname = '';
    appState.chatHistory = [];
    appState.handRaisedList = [];
    
    // 清空各个输入框和显示区域
    const elementsToReset = [
        'soupTitle', 'soupSolution', 'participantName', 'inviteCode',
        'hostInviteCode', 'participantResponseCode', 'clueInput', 
        'questionInput', 'personalNotes'
    ];
    
    elementsToReset.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
        }
    });
    
    // 清空参与者列表
    const participantsLists = [
        'connectedParticipants', 'gameParticipantsList', 'participantViewList'
    ];
    
    participantsLists.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '';
        }
    });
    
    // 清空举手列表
    document.getElementById('handsRaisedList').innerHTML = '';
    
    // 清理会话存储中的相关数据
    sessionStorage.removeItem('pending_invite_code');
    sessionStorage.removeItem('loaded_room_code');
    
    // 移除可能存在的信息提示
    const infoMessage = document.querySelector('.info-message');
    if (infoMessage && infoMessage.parentNode) {
        infoMessage.parentNode.removeChild(infoMessage);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp); 