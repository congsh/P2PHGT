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
            { btnId: 'copyResponseCodeBtn', textareaId: 'responseCode' }
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

// 初始化应用
function initApp() {
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
        participantManager.joinGame();
    });
    
    document.getElementById('backFromJoinBtn').addEventListener('click', () => {
        viewManager.switchTo('welcomeView');
    });
    
    // 绑定主持人连接管理界面事件
    document.getElementById('connectParticipantBtn').addEventListener('click', () => {
        hostManager.connectParticipant();
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
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp); 