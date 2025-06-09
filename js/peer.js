/**
 * P2P连接管理模块
 * 负责处理WebRTC连接、提供信令交换等功能
 */
class PeerManager {
    /**
     * 初始化连接管理器
     * @param {string} role - 角色('host'或'participant')
     * @param {Function} onMessageCallback - 收到消息时的回调函数
     * @param {Function} onConnectCallback - 连接建立时的回调函数
     * @param {Function} onDisconnectCallback - 连接断开时的回调函数
     */
    constructor(role, onMessageCallback, onConnectCallback, onDisconnectCallback) {
        this.role = role; // 'host' 或 'participant'
        this.peers = {}; // 保存所有对等连接(id -> peer)
        this.onMessageCallback = onMessageCallback;
        this.onConnectCallback = onConnectCallback;
        this.onDisconnectCallback = onDisconnectCallback;
        this.iceServers = [
            // 国际STUN服务器
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // 国内可用的STUN服务器
            { urls: 'stun:stun.qq.com:3478' },
            { urls: 'stun:stun.miwifi.com:3478' },
            { urls: 'stun:stun.voipbuster.com:3478' },
            { urls: 'stun:stun.voipstunt.com:3478' },
            // 免费TURN服务器（备用，可能不稳定）
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            // 添加更多TURN服务器以提高连接成功率
            {
                urls: 'turn:relay.metered.ca:80',
                username: 'e7d69958ceb00a4f3e0d325f',
                credential: 'pCZhR+iJ9TnkGW6R'
            },
            {
                urls: 'turn:relay.metered.ca:443',
                username: 'e7d69958ceb00a4f3e0d325f',
                credential: 'pCZhR+iJ9TnkGW6R'
            }
        ];
        this.myId = this._generateId(); // 生成唯一ID
        this.currentInviteCode = null; // 当前邀请码
        this.pendingConnections = {}; // 等待连接的请求
        
        // 清理过期的房间信息
        this._cleanupExpiredRooms();
    }

    /**
     * 清理过期的房间信息
     * @private
     */
    _cleanupExpiredRooms() {
        // 清理 localStorage 中超过48小时的房间信息
        const EXPIRY_TIME = 48 * 60 * 60 * 1000; // 48小时
        const now = new Date().getTime();
        
        // 遍历localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // 只处理房间信息
            if (key && key.startsWith('room_')) {
                try {
                    const data = JSON.parse(decodeURIComponent(localStorage.getItem(key)));
                    // 检查时间戳
                    if (data.timestamp && (now - data.timestamp > EXPIRY_TIME)) {
                        localStorage.removeItem(key);
                        console.log(`已清理过期房间信息: ${key}`);
                    }
                } catch (e) {
                    console.error(`清理房间信息出错: ${key}`, e);
                }
            }
        }
    }

    /**
     * 生成邀请码（主持人用）
     * @param {Object} roomSettings - 房间设置
     * @returns {string} 短邀请码
     */
    generateInviteCode(roomSettings) {
        console.log(`[DEBUG] 开始生成邀请码...`);
        // 生成短邀请码
        const shortCode = this._generateShortCode();
        console.log(`[DEBUG] 生成的短邀请码: ${shortCode}`);
        
        // 将主持人信息和房间设置存储起来
        const inviteData = {
            hostId: this.myId,
            roomSettings: roomSettings,
            timestamp: new Date().getTime()
        };
        console.log(`[DEBUG] 创建的邀请数据:`, inviteData);
        
        // 将完整数据存储到localStorage（本地备份）
        const shortCodeKey = `room_${shortCode}`;
        localStorage.setItem(shortCodeKey, encodeURIComponent(JSON.stringify(inviteData)));
        console.log(`[DEBUG] 邀请数据已保存到本地存储: ${shortCodeKey}`);
        
        // 将邀请码数据编码为URL安全的字符串
        const encodedData = btoa(encodeURIComponent(JSON.stringify(inviteData)));
        console.log(`[DEBUG] 编码后的数据长度: ${encodedData.length}`);
        
        // 将邀请码和编码数据关联存储在sessionStorage中
        // 这样其他用户可以通过URL参数获取这些数据
        sessionStorage.setItem(`invite_data_${shortCode}`, encodedData);
        console.log(`[DEBUG] 邀请数据已存储到sessionStorage`);
        
        // 设置过期时间（48小时后自动清理本地存储）
        setTimeout(() => {
            localStorage.removeItem(shortCodeKey);
            console.log(`[DEBUG] 本地存储的邀请码数据已过期并清理: ${shortCodeKey}`);
        }, 48 * 60 * 60 * 1000);
        
        // 将短邀请码与完整信息关联
        this.currentInviteCode = shortCode;
        console.log(`[DEBUG] 邀请码生成完成: ${shortCode}`);
        
        return shortCode;
    }

    /**
     * 解析邀请码（参与者用）
     * @param {string} inviteCode - 主持人分享的邀请码
     * @returns {Object|Promise} 解析后的邀请数据或Promise
     */
    parseInviteCode(inviteCode) {
        try {
            console.log(`[DEBUG] parseInviteCode开始处理邀请码: ${inviteCode}`);
            const formattedCode = inviteCode.trim().toUpperCase();
            console.log(`[DEBUG] 格式化后的邀请码: ${formattedCode}`);
            const shortCodeKey = `room_${formattedCode}`;
            console.log(`[DEBUG] 本地存储键: ${shortCodeKey}`);
            
            // 首先尝试从本地存储获取数据
            const storedData = localStorage.getItem(shortCodeKey);
            console.log(`[DEBUG] 本地存储数据: ${storedData ? '找到' : '未找到'}`);
            
            if (storedData) {
                console.log(`[DEBUG] 从本地存储返回数据`);
                return JSON.parse(decodeURIComponent(storedData));
            }
            
            // 如果本地没有数据，尝试从URL参数获取
            console.log(`[DEBUG] 本地未找到邀请码数据，尝试从URL参数获取`);
            const urlParams = new URLSearchParams(window.location.search);
            const roomCode = urlParams.get('room');
            const encodedData = urlParams.get('data');
            
            // 检查URL中的邀请码是否与当前处理的邀请码匹配
            if (roomCode && roomCode.toUpperCase() === formattedCode && encodedData) {
                console.log(`[DEBUG] 从URL参数获取到编码数据，长度: ${encodedData.length}`);
                try {
                    const decodedData = JSON.parse(decodeURIComponent(atob(encodedData)));
                    console.log(`[DEBUG] 解码成功:`, decodedData);
                    
                    // 保存到本地存储
                    localStorage.setItem(shortCodeKey, encodeURIComponent(JSON.stringify(decodedData)));
                    console.log(`[DEBUG] 已保存到本地存储`);
                    
                    // 清除URL参数但不刷新页面
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    return decodedData;
                } catch (e) {
                    console.error(`[DEBUG] URL参数解码失败:`, e);
                    throw new Error('URL参数解码失败，请尝试刷新页面或重新获取邀请链接');
                }
            }
            
            // 如果没有从URL获取到数据，尝试从sessionStorage获取
            console.log(`[DEBUG] 尝试从sessionStorage获取数据`);
            const sessionData = sessionStorage.getItem(`invite_data_${formattedCode}`);
            
            if (sessionData) {
                console.log(`[DEBUG] 从sessionStorage获取到数据，长度: ${sessionData.length}`);
                try {
                    const decodedData = JSON.parse(decodeURIComponent(atob(sessionData)));
                    console.log(`[DEBUG] sessionStorage数据解码成功:`, decodedData);
                    
                    // 保存到本地存储
                    localStorage.setItem(shortCodeKey, encodeURIComponent(JSON.stringify(decodedData)));
                    console.log(`[DEBUG] 已保存到本地存储`);
                    
                    return decodedData;
                } catch (e) {
                    console.error(`[DEBUG] sessionStorage数据解码失败:`, e);
                    throw new Error('会话数据解码失败，请刷新页面重试');
                }
            }
            
            // 检查是否有已经加载的房间数据
            const loadedRoomCode = sessionStorage.getItem('loaded_room_code');
            if (loadedRoomCode && loadedRoomCode === formattedCode) {
                // 尝试再次从本地存储获取数据
                const reloadedData = localStorage.getItem(shortCodeKey);
                if (reloadedData) {
                    console.log(`[DEBUG] 从已加载的房间数据中获取信息`);
                    return JSON.parse(decodeURIComponent(reloadedData));
                }
            }
            
            // 都没有找到数据，抛出错误
            console.error(`[DEBUG] 未找到邀请码数据`);
            throw new Error('未找到与该邀请码关联的房间信息，请确保输入正确，或等待主持人分享房间信息');
        } catch (e) {
            console.error('[DEBUG] 邀请码解析失败:', e);
            throw e;
        }
    }

    /**
     * 开始等待邀请码数据的检查
     * @private
     */
    _startPendingInviteCheck() {
        const pendingCode = sessionStorage.getItem('pending_invite_code');
        if (!pendingCode) return;
        
        const shortCodeKey = `room_${pendingCode}`;
        const checkInterval = setInterval(() => {
            const storedData = localStorage.getItem(shortCodeKey);
            if (storedData) {
                clearInterval(checkInterval);
                sessionStorage.removeItem('pending_invite_code');
                sessionStorage.setItem(shortCodeKey, storedData);
                // 页面刷新以重新加载邀请码
                window.location.reload();
            }
        }, 1000); // 每秒检查一次
        
        // 30秒后停止检查
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 30000);
    }

    /**
     * 生成连接请求码（参与者用）
     * @param {string} nickname - 参与者昵称
     * @param {string} inviteCode - 邀请码
     * @returns {Promise<string>} 连接请求码
     */
    generateConnectionRequest(nickname, inviteCode) {
        console.log(`[DEBUG] 开始生成连接请求码，昵称: ${nickname}, 邀请码: ${inviteCode}`);
        
        return new Promise((resolve, reject) => {
            try {
                // 创建连接请求数据
                const requestData = {
                    participantId: this.myId,
                    nickname: nickname,
                    inviteCode: inviteCode,
                    timestamp: new Date().getTime()
                };
                
                // 编码为连接请求码
                const connectionRequestCode = btoa(encodeURIComponent(JSON.stringify(requestData)));
                console.log(`[DEBUG] 连接请求码生成成功，长度: ${connectionRequestCode.length}`);
                
                resolve(connectionRequestCode);
            } catch (error) {
                console.error(`[DEBUG] 生成连接请求码失败:`, error);
                reject(error);
            }
        });
    }
    
    /**
     * 处理连接请求（主持人用）
     * @param {string} connectionRequestCode - 连接请求码
     * @returns {Promise<Object>} 处理结果
     */
    processConnectionRequest(connectionRequestCode) {
        console.log(`[DEBUG] 开始处理连接请求码`);
        
        return new Promise((resolve, reject) => {
            try {
                // 解码连接请求数据
                const requestData = JSON.parse(decodeURIComponent(atob(connectionRequestCode)));
                const { participantId, nickname, inviteCode } = requestData;
                
                console.log(`[DEBUG] 解析连接请求成功，参与者ID: ${participantId}, 昵称: ${nickname}, 邀请码: ${inviteCode}`);
                
                // 验证邀请码
                const shortCodeKey = `room_${inviteCode.trim().toUpperCase()}`;
                const storedData = localStorage.getItem(shortCodeKey);
                
                if (!storedData) {
                    console.error(`[DEBUG] 无效的邀请码: ${inviteCode}`);
                    reject(new Error('无效的邀请码'));
                    return;
                }
                
                // 创建对等连接
                console.log(`[DEBUG] 创建对等连接对象...`);
                const peer = new SimplePeer({
                    initiator: true,
                    trickle: false,
                    config: { iceServers: this.iceServers },
                    debug: true
                });
                
                // 保存连接对象
                this.peers[participantId] = {
                    peer: peer,
                    nickname: nickname,
                    connected: false
                };
                
                // 设置事件处理
                this._setupPeerEvents(peer, participantId, nickname);
                
                // 当信号可用时，生成连接码
                peer.on('signal', signal => {
                    console.log(`[DEBUG] 生成连接信号，类型: ${signal.type}`);
                    
                    // 创建连接响应数据
                    const responseData = {
                        hostId: this.myId,
                        participantId: participantId,
                        signal: signal
                    };
                    
                    // 编码为连接响应码
                    const connectionResponseCode = btoa(encodeURIComponent(JSON.stringify(responseData)));
                    console.log(`[DEBUG] 连接响应码生成成功，长度: ${connectionResponseCode.length}`);
                    
                    resolve({
                        participantId,
                        nickname,
                        connectionResponseCode
                    });
                });
                
                // 处理错误
                peer.on('error', err => {
                    console.error(`[DEBUG] 创建连接时出错:`, err);
                    reject(err);
                });
                
            } catch (error) {
                console.error(`[DEBUG] 处理连接请求失败:`, error);
                reject(error);
            }
        });
    }
    
    /**
     * 处理连接响应（参与者用）
     * @param {string} connectionResponseCode - 连接响应码
     * @returns {Promise<boolean>} 处理结果
     */
    processConnectionResponse(connectionResponseCode) {
        console.log(`[DEBUG] 开始处理连接响应码`);
        
        return new Promise((resolve, reject) => {
            try {
                // 解码连接响应数据
                const responseData = JSON.parse(decodeURIComponent(atob(connectionResponseCode)));
                const { hostId, participantId, signal } = responseData;
                
                console.log(`[DEBUG] 解析连接响应成功，主持人ID: ${hostId}, 参与者ID: ${participantId}`);
                
                // 验证参与者ID
                if (participantId !== this.myId) {
                    console.error(`[DEBUG] 参与者ID不匹配: ${participantId} != ${this.myId}`);
                    reject(new Error('无效的连接响应'));
                    return;
                }
                
                // 创建对等连接
                console.log(`[DEBUG] 创建对等连接对象...`);
                const peer = new SimplePeer({
                    initiator: false,
                    trickle: false,
                    config: { iceServers: this.iceServers },
                    debug: true
                });
                
                // 保存连接对象
                this.peers[hostId] = {
                    peer: peer,
                    nickname: "主持人",
                    connected: false
                };
                
                // 设置事件处理
                this._setupPeerEvents(peer, hostId, "主持人");
                
                // 处理信号
                peer.signal(signal);
                
                // 当信号可用时，生成应答码
                peer.on('signal', answerSignal => {
                    console.log(`[DEBUG] 生成应答信号，类型: ${answerSignal.type}`);
                    
                    // 创建应答数据
                    const answerData = {
                        participantId: this.myId,
                        hostId: hostId,
                        signal: answerSignal
                    };
                    
                    // 编码为应答码
                    const answerCode = btoa(encodeURIComponent(JSON.stringify(answerData)));
                    console.log(`[DEBUG] 应答码生成成功，长度: ${answerCode.length}`);
                    
                    resolve({
                        hostId,
                        answerCode
                    });
                });
                
                // 处理错误
                peer.on('error', err => {
                    console.error(`[DEBUG] 创建连接时出错:`, err);
                    reject(err);
                });
                
            } catch (error) {
                console.error(`[DEBUG] 处理连接响应失败:`, error);
                reject(error);
            }
        });
    }
    
    /**
     * 完成连接（主持人用）
     * @param {string} answerCode - 应答码
     * @returns {Promise<boolean>} 处理结果
     */
    finalizeConnection(answerCode) {
        console.log(`[DEBUG] 开始完成连接`);
        
        return new Promise((resolve, reject) => {
            try {
                // 解码应答数据
                const answerData = JSON.parse(decodeURIComponent(atob(answerCode)));
                const { participantId, hostId, signal } = answerData;
                
                console.log(`[DEBUG] 解析应答成功，参与者ID: ${participantId}, 主持人ID: ${hostId}`);
                
                // 验证主持人ID
                if (hostId !== this.myId) {
                    console.error(`[DEBUG] 主持人ID不匹配: ${hostId} != ${this.myId}`);
                    reject(new Error('无效的应答码'));
                    return;
                }
                
                // 获取已保存的peer对象
                const peerInfo = this.peers[participantId];
                if (!peerInfo || !peerInfo.peer) {
                    console.error(`[DEBUG] 未找到对应的连接对象: ${participantId}`);
                    reject(new Error('未找到对应的连接请求'));
                    return;
                }
                
                // 处理信号
                console.log(`[DEBUG] 处理应答信号...`);
                peerInfo.peer.signal(signal);
                
                // 返回成功
                resolve(true);
                
            } catch (error) {
                console.error(`[DEBUG] 完成连接失败:`, error);
                reject(error);
            }
        });
    }

    /**
     * 向指定参与者发送消息（主持人用）
     * @param {string} participantId - 参与者ID，如果为null则发送给所有参与者
     * @param {Object} message - 消息内容
     */
    sendToParticipant(participantId, message) {
        const messageStr = JSON.stringify(message);
        
        // 如果没有指定ID，则广播给所有人
        if (!participantId) {
            Object.keys(this.peers).forEach(id => {
                if (this.peers[id] && this.peers[id].connected) {
                    this.peers[id].peer.send(messageStr);
                }
            });
        } 
        // 否则只发给指定参与者
        else if (this.peers[participantId] && this.peers[participantId].connected) {
            this.peers[participantId].peer.send(messageStr);
        }
    }

    /**
     * 向主持人发送消息（参与者用）
     * @param {Object} message - 消息内容
     */
    sendToHost(message) {
        if (this.role !== 'participant') {
            console.error('只有参与者才能使用sendToHost方法');
            return;
        }

        const messageStr = JSON.stringify(message);
        // 参与者只会有一个连接对象，即主持人
        const hostId = Object.keys(this.peers)[0];
        
        if (hostId && this.peers[hostId] && this.peers[hostId].connected) {
            this.peers[hostId].peer.send(messageStr);
        } else {
            console.error('主持人连接不可用');
        }
    }

    /**
     * 获取连接的参与者列表
     * @returns {Array} 参与者列表，包含ID和昵称
     */
    getConnectedPeers() {
        return Object.keys(this.peers)
            .filter(id => this.peers[id].connected)
            .map(id => ({
                id: id,
                nickname: this.peers[id].nickname
            }));
    }

    /**
     * 设置对等连接的事件处理（内部方法）
     * @param {SimplePeer} peer - SimplePeer对象
     * @param {string} peerId - 对等方ID
     * @param {string} nickname - 对等方昵称
     * @private
     */
    _setupPeerEvents(peer, peerId, nickname) {
        // 信号变更事件
        peer.on('signal', data => {
            console.log(`[Peer事件] 信号变更 - ${nickname}(${peerId})`, data.type);
            
            // 如果是参与者，尝试自动获取主持人的应答信号
            if (this.role === 'participant') {
                const signalChannel = `webrtc_signal_${this.myId}`;
                try {
                    const storedSignal = localStorage.getItem(signalChannel);
                    if (storedSignal) {
                        console.log(`[Peer事件] 发现存储的应答信号，尝试处理`);
                        this.processAnswerCode(storedSignal);
                        localStorage.removeItem(signalChannel);
                    }
                } catch (e) {
                    console.error(`[Peer事件] 检查应答信号失败:`, e);
                }
            }
        });
        
        // 连接建立成功
        peer.on('connect', () => {
            console.log(`[Peer事件] 与 ${nickname}(${peerId}) 的连接已建立成功`);
            this.peers[peerId].connected = true;
            
            // 调用连接成功回调
            if (this.onConnectCallback) {
                try {
                    console.log(`[Peer事件] 执行连接成功回调，参与者ID: ${peerId}, 昵称: ${nickname}`);
                    this.onConnectCallback(peerId, nickname);
                } catch (e) {
                    console.error(`[Peer事件] 连接成功回调执行失败:`, e);
                }
            }
            
            // 对于参与者，在连接成功时尝试主动发送一条测试消息
            if (this.role === 'participant') {
                console.log(`[Peer事件] 参与者连接成功，尝试发送测试消息`);
                setTimeout(() => {
                    try {
                        this.peers[peerId].peer.send(JSON.stringify({
                            type: 'C2H_INTERACTION',
                            payload: { 
                                type: 'connect_success',
                                timestamp: new Date().getTime()
                            }
                        }));
                        console.log(`[Peer事件] 测试消息已发送`);
                    } catch (e) {
                        console.error(`[Peer事件] 发送测试消息失败:`, e);
                    }
                }, 500);
            }
        });

        // 接收到数据
        peer.on('data', data => {
            try {
                console.log(`[Peer事件] 收到数据 - 来自 ${nickname}(${peerId}):`, data.toString().substring(0, 100));
                const message = JSON.parse(data);
                
                // 调用消息处理回调
                if (this.onMessageCallback) {
                    this.onMessageCallback(message, peerId, nickname);
                }
            } catch (e) {
                console.error(`[Peer事件] 消息解析失败:`, e);
            }
        });

        // 连接错误
        peer.on('error', err => {
            console.error(`[Peer事件] 连接错误 (${peerId}):`, err);
        });

        // 连接关闭
        peer.on('close', () => {
            console.log(`[Peer事件] 与 ${nickname}(${peerId}) 的连接已关闭`);
            this.peers[peerId].connected = false;
            
            // 调用断开连接回调
            if (this.onDisconnectCallback) {
                this.onDisconnectCallback(peerId, nickname);
            }
        });
    }

    /**
     * 生成唯一ID（内部方法）
     * @returns {string} 唯一ID
     * @private
     */
    _generateId() {
        // 生成一个简单的随机ID
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }
    
    /**
     * 生成短邀请码
     * @returns {string} 5-12位的短邀请码
     * @private
     */
    _generateShortCode() {
        // 创建一个包含字母和数字的字符集（排除容易混淆的字符如0,O,1,I,l）
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        
        // 生成6-10位随机码
        const codeLength = Math.floor(Math.random() * 5) + 6; // 6-10位
        for (let i = 0; i < codeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return code;
    }

    /**
     * 共享房间信息到指定URL
     * 用于跨设备共享房间信息
     * @param {string} code - 邀请码
     * @returns {string} 可共享的URL
     */
    shareRoomInfo(code = null) {
        console.log(`[DEBUG] shareRoomInfo开始，邀请码: ${code || this.currentInviteCode}`);
        const inviteCode = code || this.currentInviteCode;
        if (!inviteCode) {
            console.log(`[DEBUG] 没有有效的邀请码`);
            return null;
        }
        
        // 获取邀请码数据
        const shortCodeKey = `room_${inviteCode}`;
        const roomData = localStorage.getItem(shortCodeKey);
        
        if (roomData) {
            console.log(`[DEBUG] 从本地存储获取到房间数据`);
            
            // 获取sessionStorage中存储的编码数据
            const encodedData = sessionStorage.getItem(`invite_data_${inviteCode}`);
            if (encodedData) {
                console.log(`[DEBUG] 从sessionStorage获取到编码数据，长度: ${encodedData.length}`);
                
                // 返回带有查询参数的URL
                const currentUrl = window.location.href.split('?')[0];
                const shareUrl = `${currentUrl}?room=${inviteCode}&data=${encodedData}`;
                console.log(`[DEBUG] 生成的分享URL: ${shareUrl.substring(0, 50)}...`);
                
                return shareUrl;
            } else {
                // 如果没有找到编码数据，重新编码
                console.log(`[DEBUG] 未找到编码数据，重新编码`);
                const decodedData = JSON.parse(decodeURIComponent(roomData));
                const newEncodedData = btoa(encodeURIComponent(JSON.stringify(decodedData)));
                console.log(`[DEBUG] 重新编码的数据长度: ${newEncodedData.length}`);
                
                // 保存到sessionStorage
                sessionStorage.setItem(`invite_data_${inviteCode}`, newEncodedData);
                
                // 返回带有查询参数的URL
                const currentUrl = window.location.href.split('?')[0];
                const shareUrl = `${currentUrl}?room=${inviteCode}&data=${newEncodedData}`;
                console.log(`[DEBUG] 生成的分享URL: ${shareUrl.substring(0, 50)}...`);
                
                return shareUrl;
            }
        }
        
        console.log(`[DEBUG] 未找到房间数据`);
        return null;
    }
    
    /**
     * 检查URL中是否包含房间邀请码
     * 如果有，自动加载房间信息
     */
    static checkUrlForInviteCode() {
        console.log(`[DEBUG] 检查URL中的邀请码...`);
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        const encodedData = urlParams.get('data');
        
        if (roomCode) {
            console.log(`[DEBUG] URL中找到邀请码: ${roomCode}`);
            
            // 将邀请码保存到会话存储，以便后续使用
            sessionStorage.setItem('pending_invite_code', roomCode);
            
            if (encodedData) {
                console.log(`[DEBUG] URL中找到编码数据，长度: ${encodedData.length}`);
                try {
                    // 解码数据
                    const decodedData = JSON.parse(decodeURIComponent(atob(encodedData)));
                    console.log(`[DEBUG] 解码成功:`, decodedData);
                    
                    // 保存到localStorage和sessionStorage
                    const roomKey = `room_${roomCode}`;
                    localStorage.setItem(roomKey, encodeURIComponent(JSON.stringify(decodedData)));
                    sessionStorage.setItem(`invite_data_${roomCode}`, encodedData);
                    
                    // 表明房间数据已加载
                    sessionStorage.setItem('loaded_room_code', roomCode);
                    console.log(`[DEBUG] 已加载房间数据: ${roomCode}`);
                    
                    // 不要立即清除URL参数，让页面加载完成后再清除
                    setTimeout(() => {
                        window.history.replaceState({}, document.title, window.location.pathname);
                        console.log(`[DEBUG] URL参数已清除`);
                    }, 1000);
                    
                    return roomCode;
                } catch (e) {
                    console.error(`[DEBUG] 解析URL编码数据失败:`, e);
                    return null;
                }
            } else {
                console.log(`[DEBUG] URL中没有找到编码数据，只有邀请码`);
                // 如果只有邀请码没有数据，可能需要从其他地方获取数据
                return roomCode;
            }
        } else {
            console.log(`[DEBUG] URL中没有找到邀请码`);
        }
        
        return null;
    }

    /**
     * 检查邀请码是否有效
     * @param {string} inviteCode - 要检查的邀请码
     * @returns {Object} 检查结果，包含是否有效和诊断信息
     */
    static checkInviteCodeValidity(inviteCode) {
        console.log(`[DEBUG] 开始检查邀请码有效性: ${inviteCode}`);
        const result = {
            isValid: false,
            diagnostics: {
                localStorage: false,
                sessionStorage: false,
                urlParams: false,
                details: {}
            }
        };
        
        try {
            // 格式化邀请码
            const formattedCode = inviteCode.trim().toUpperCase();
            const shortCodeKey = `room_${formattedCode}`;
            
            // 检查本地存储
            const storedData = localStorage.getItem(shortCodeKey);
            if (storedData) {
                result.isValid = true;
                result.diagnostics.localStorage = true;
                result.diagnostics.details.localStorage = {
                    found: true,
                    size: storedData.length
                };
                
                try {
                    const parsedData = JSON.parse(decodeURIComponent(storedData));
                    result.diagnostics.details.localStorage.parsed = true;
                    result.diagnostics.details.localStorage.hostId = parsedData.hostId;
                    result.diagnostics.details.localStorage.timestamp = new Date(parsedData.timestamp).toLocaleString();
                } catch (e) {
                    result.diagnostics.details.localStorage.parsed = false;
                    result.diagnostics.details.localStorage.error = e.message;
                }
            } else {
                result.diagnostics.details.localStorage = {
                    found: false
                };
            }
            
            // 检查会话存储
            const sessionData = sessionStorage.getItem(`invite_data_${formattedCode}`);
            if (sessionData) {
                result.isValid = true;
                result.diagnostics.sessionStorage = true;
                result.diagnostics.details.sessionStorage = {
                    found: true,
                    size: sessionData.length
                };
            } else {
                result.diagnostics.details.sessionStorage = {
                    found: false
                };
            }
            
            // 检查URL参数
            const urlParams = new URLSearchParams(window.location.search);
            const roomCode = urlParams.get('room');
            const encodedData = urlParams.get('data');
            
            if (roomCode && roomCode.toUpperCase() === formattedCode && encodedData) {
                result.isValid = true;
                result.diagnostics.urlParams = true;
                result.diagnostics.details.urlParams = {
                    found: true,
                    roomCode: roomCode,
                    dataSize: encodedData.length
                };
            } else {
                result.diagnostics.details.urlParams = {
                    found: false,
                    currentUrl: window.location.href
                };
            }
            
            // 检查是否有已加载的房间码
            const loadedRoomCode = sessionStorage.getItem('loaded_room_code');
            if (loadedRoomCode && loadedRoomCode === formattedCode) {
                result.diagnostics.details.loadedRoomCode = {
                    found: true,
                    code: loadedRoomCode
                };
            } else {
                result.diagnostics.details.loadedRoomCode = {
                    found: false
                };
            }
            
            // 检查是否有待处理的邀请码
            const pendingCode = sessionStorage.getItem('pending_invite_code');
            if (pendingCode && pendingCode === formattedCode) {
                result.diagnostics.details.pendingCode = {
                    found: true,
                    code: pendingCode
                };
            } else {
                result.diagnostics.details.pendingCode = {
                    found: false
                };
            }
            
            // 检查浏览器存储权限
            result.diagnostics.details.storageAvailable = {
                localStorage: this._isStorageAvailable('localStorage'),
                sessionStorage: this._isStorageAvailable('sessionStorage')
            };
            
            console.log(`[DEBUG] 邀请码检查结果:`, result);
            return result;
        } catch (e) {
            console.error(`[DEBUG] 检查邀请码时出错:`, e);
            result.diagnostics.details.error = e.message;
            return result;
        }
    }
    
    /**
     * 检查存储是否可用
     * @param {string} type - 存储类型 ('localStorage' 或 'sessionStorage')
     * @returns {boolean} 存储是否可用
     * @private
     */
    static _isStorageAvailable(type) {
        try {
            const storage = window[type];
            const x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return false;
        }
    }
}

// 全局导出
window.PeerManager = PeerManager; 