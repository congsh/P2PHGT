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
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
        this.myId = this._generateId(); // 生成唯一ID
        this.currentInviteCode = null; // 当前邀请码
        
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
        // 生成短邀请码
        const shortCode = this._generateShortCode();
        
        // 将主持人信息和房间设置存储起来
        const inviteData = {
            hostId: this.myId,
            roomSettings: roomSettings,
            timestamp: new Date().getTime()
        };
        
        // 将完整数据存储到localStorage
        const shortCodeKey = `room_${shortCode}`;
        localStorage.setItem(shortCodeKey, encodeURIComponent(JSON.stringify(inviteData)));
        
        // 设置过期时间（48小时后自动清理）
        setTimeout(() => {
            localStorage.removeItem(shortCodeKey);
        }, 48 * 60 * 60 * 1000);
        
        // 将短邀请码与完整信息关联
        this.currentInviteCode = shortCode;
        
        return shortCode;
    }

    /**
     * 解析邀请码（参与者用）
     * @param {string} inviteCode - 主持人分享的邀请码
     * @returns {Object} 解析后的邀请数据
     */
    parseInviteCode(inviteCode) {
        try {
            const shortCodeKey = `room_${inviteCode.trim().toUpperCase()}`;
            const storedData = localStorage.getItem(shortCodeKey);
            
            if (!storedData) {
                // 尝试在 SessionStorage 中查找
                if(sessionStorage.getItem(shortCodeKey)) {
                    return JSON.parse(decodeURIComponent(sessionStorage.getItem(shortCodeKey)));
                }
                
                // 如果找不到数据，可能是新生成的邀请码
                // 将邀请码保存到Session中，等待主持人共享数据
                sessionStorage.setItem('pending_invite_code', inviteCode.trim().toUpperCase());
                
                // 需要定期检查是否有新数据
                this._startPendingInviteCheck();
                
                throw new Error('未找到与该邀请码关联的房间信息，请确保输入正确，或等待主持人分享房间信息');
            }
            
            return JSON.parse(decodeURIComponent(storedData));
        } catch (e) {
            console.error('邀请码解析失败:', e);
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
     * 生成响应码（参与者用）
     * @param {string} hostId - 主持人ID
     * @param {string} nickname - 参与者昵称
     * @returns {string} 响应码
     */
    generateResponseCode(hostId, nickname) {
        // 创建参与者到主持人的offer信令
        return new Promise((resolve) => {
            const peer = new SimplePeer({
                initiator: true,
                trickle: false,
                config: { iceServers: this.iceServers }
            });

            peer.on('signal', data => {
                // 当信令可用时，生成响应码
                const responseData = {
                    participantId: this.myId,
                    nickname: nickname,
                    signalData: data
                };
                // 保存连接对象，以便后续处理
                this.peers[hostId] = {
                    peer: peer,
                    nickname: "主持人",
                    connected: false
                };

                // 设置接收消息的处理
                this._setupPeerEvents(peer, hostId, "主持人");

                // 返回编码后的响应数据（支持Unicode）
                resolve(btoa(encodeURIComponent(JSON.stringify(responseData))));
            });
        });
    }

    /**
     * 处理参与者的响应码（主持人用）
     * @param {string} responseCode - 参与者的响应码
     * @returns {Promise<Object>} 连接结果
     */
    processResponseCode(responseCode) {
        try {
            console.log("[主持人] 开始解析响应码...");
            const responseData = JSON.parse(decodeURIComponent(atob(responseCode)));
            const participantId = responseData.participantId;
            const nickname = responseData.nickname;
            const signalData = responseData.signalData;
            
            console.log(`[主持人] 解析成功，参与者ID: ${participantId}, 昵称: ${nickname}`);
            console.log(`[主持人] 信号类型: ${signalData.type}`);

            // 创建主持人到参与者的连接
            console.log("[主持人] 创建对等连接对象...");
            const peer = new SimplePeer({
                initiator: false,
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
            
            console.log(`[主持人] 已保存连接对象，为参与者 ${nickname}(${participantId})`);

            // 设置消息处理
            this._setupPeerEvents(peer, participantId, nickname);
            console.log("[主持人] 已设置事件处理");

            return new Promise((resolve) => {
                console.log("[主持人] 等待信号生成...");
                
                // 创建一个临时服务器来自动交换剩余的信令
                // 使用临时LocalStorage模拟媒介，这在同一浏览器/域下工作
                const signalChannel = `webrtc_signal_${participantId}`;
                
                // 当需要回应信令时
                peer.on('signal', data => {
                    console.log(`[主持人] 生成应答信号，类型: ${data.type}`);
                    
                    // 向参与者发送应答信号
                    const answerData = {
                        hostId: this.myId,
                        signalData: data
                    };
                    
                    // 在临时存储中保存应答数据
                    try {
                        localStorage.setItem(signalChannel, btoa(encodeURIComponent(JSON.stringify(answerData))));
                        console.log(`[主持人] 应答信号已保存到临时通道: ${signalChannel}`);
                    } catch (e) {
                        console.error("[主持人] 无法保存应答信号:", e);
                    }
                    
                    const answerCode = btoa(encodeURIComponent(JSON.stringify(answerData)));
                    console.log("[主持人] 应答码生成完毕，长度:", answerCode.length);

                    resolve({
                        participantId,
                        nickname,
                        answerCode: answerCode
                    });
                });

                // 处理参与者发来的信号
                console.log("[主持人] 开始处理参与者的信号...");
                peer.signal(signalData);
                console.log("[主持人] 信号处理完毕，等待连接建立");
            });
        } catch (e) {
            console.error('[主持人] 响应码处理失败:', e);
            console.error(e.stack);
            return Promise.reject('响应码格式错误: ' + e.message);
        }
    }

    /**
     * 处理主持人的应答码（参与者用）
     * @param {string} answerCode - 主持人发回的应答码
     */
    processAnswerCode(answerCode) {
        try {
            console.log("开始处理主持人应答码");
            const answerData = JSON.parse(decodeURIComponent(atob(answerCode)));
            const hostId = answerData.hostId;
            const signalData = answerData.signalData;
            
            console.log("解析应答码成功，主持人ID:", hostId);

            if (this.peers[hostId] && this.peers[hostId].peer) {
                console.log("找到对应的连接对象，正在处理信号");
                // 将主持人的应答信令传给对等连接对象
                this.peers[hostId].peer.signal(signalData);
                
                // 检查连接状态
                setTimeout(() => {
                    console.log("连接状态检查:", this.peers[hostId].connected);
                    if (!this.peers[hostId].connected) {
                        console.log("连接尚未建立，尝试手动触发回调");
                        if (this.onConnectCallback) {
                            this.onConnectCallback(hostId, "主持人");
                        }
                    }
                }, 5000);
                
                return true;
            } else {
                console.error('找不到对应的主持人连接');
                return false;
            }
        } catch (e) {
            console.error('应答码处理失败:', e);
            console.error(e);
            return false;
        }
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
        const inviteCode = code || this.currentInviteCode;
        if (!inviteCode) return null;
        
        const shortCodeKey = `room_${inviteCode}`;
        const roomData = localStorage.getItem(shortCodeKey);
        
        if (roomData) {
            // 创建一个包含房间数据的对象
            const shareData = {
                code: inviteCode,
                data: roomData
            };
            
            // 将数据存储到一个通用位置
            const shareKey = `shared_room_${inviteCode}`;
            localStorage.setItem(shareKey, encodeURIComponent(JSON.stringify(shareData)));
            
            // 设置过期时间（1小时）
            setTimeout(() => {
                localStorage.removeItem(shareKey);
            }, 60 * 60 * 1000);
            
            // 返回带有查询参数的URL
            const currentUrl = window.location.href.split('?')[0];
            return `${currentUrl}?room=${inviteCode}`;
        }
        
        return null;
    }
    
    /**
     * 检查URL中是否包含房间邀请码
     * 如果有，自动加载房间信息
     */
    static checkUrlForInviteCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        
        if (roomCode) {
            // 清除URL参数但不刷新页面
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // 尝试加载共享的房间数据
            const shareKey = `shared_room_${roomCode}`;
            const sharedData = localStorage.getItem(shareKey);
            
            if (sharedData) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(sharedData));
                    if (parsed.code && parsed.data) {
                        const roomKey = `room_${parsed.code}`;
                        localStorage.setItem(roomKey, parsed.data);
                        
                        // 表明房间数据已加载
                        sessionStorage.setItem('loaded_room_code', roomCode);
                        console.log(`已加载共享房间数据: ${roomCode}`);
                        return roomCode;
                    }
                } catch (e) {
                    console.error('解析共享房间数据失败:', e);
                }
            } else {
                // 如果没有找到共享数据，也保存邀请码以便后续使用
                sessionStorage.setItem('pending_invite_code', roomCode);
            }
        }
        
        return null;
    }
}

// 全局导出
window.PeerManager = PeerManager; 