// Deepseek API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_TIMEOUT = 30000; // 30秒超时
let DEEPSEEK_API_KEY = null;

// 导入marked库用于Markdown渲染
let marked;

// API调用状态管理
let isApiCalling = false;
let currentAbortController = null;

// 获取DOM元素
document.addEventListener('DOMContentLoaded', function() {
    const chatWindow = document.querySelector('.chat-window');
    const textarea = document.querySelector('.input-area textarea');
    const sendButton = document.querySelector('.input-area button');

    // 初始化Markdown渲染器
    initMarkdown();
    
    // 初始化API密钥
    initAPIKey();

    // 监听发送按钮点击事件
    sendButton.addEventListener('click', handleSendMessage);
    
    // 监听键盘事件，按下回车键发送消息
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // 设置初始焦点
    textarea.focus();
});

// 初始化Markdown渲染器
function initMarkdown() {
    // 动态导入marked库
    import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js').then(module => {
        marked = module.marked;
        
        // 配置Markdown设置
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false,
            sanitize: false,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {}
                }
                
                try {
                    return hljs.highlightAuto(code).value;
                } catch (err) {}
                
                return code;
            }
        });
    }).catch(error => {
        console.error('Markdown渲染器加载失败:', error);
    });
}

// 初始化API密钥
function initAPIKey() {
    // 安全获取API密钥的策略
    const apiKeySources = [
        // 1. 从环境变量获取（开发环境）
        () => process.env?.DEEPSEEK_API_KEY,
        // 2. 从localStorage获取（用户配置）
        () => localStorage.getItem('deepseek_api_key'),
        // 3. 从后端API获取（生产环境）
        async () => {
            try {
                const response = await fetch('/api/get-deepseek-key', {
                    method: 'GET',
                    credentials: 'same-origin'
                });
                if (response.ok) {
                    const data = await response.json();
                    return data.apiKey;
                }
            } catch (error) {
                console.warn('从后端获取API密钥失败:', error);
            }
            return null;
        },
        // 4. 默认测试密钥（仅开发环境使用，从环境变量读取，不硬编码）
        () => process.env?.DEEPSEEK_API_KEY || null
    ];

    // 按优先级尝试获取API密钥
    for (const source of apiKeySources) {
        try {
            const key = typeof source === 'function' ? source() : source;
            if (key && key.trim()) {
                DEEPSEEK_API_KEY = key.trim();
                console.log('API密钥已加载');
                return;
            }
        } catch (error) {
            console.warn('API密钥获取源失败:', error);
        }
    }
    
    console.error('未找到有效的API密钥');
}

// 处理发送消息
async function handleSendMessage() {
    if (isApiCalling) {
        console.warn('已有API调用在进行中');
        return;
    }
    
    const textarea = document.querySelector('.input-area textarea');
    const chatWindow = document.querySelector('.chat-window');
    const userInput = textarea.value.trim();
    
    // 验证输入
    if (!userInput) {
        showNotification('请输入问题内容', 'warning');
        return;
    }
    
    if (userInput.length > 2000) {
        showNotification('问题内容过长，请控制在2000字符以内', 'warning');
        return;
    }
    
    // 清空输入框
    textarea.value = '';
    
    // 添加用户消息到聊天窗口
    appendMessage('user', userInput, false);
    
    // 添加AI消息容器，准备接收流式响应
    const aiMessageElement = appendMessage('ai', '', true);
    aiMessageElement.classList.add('typing');
    
    // 保存原始内容，用于流式更新
    let markdownContent = '';
    let lastUpdateTime = Date.now();
    const updateInterval = 100; // 每100ms更新一次UI
    
    // 禁用发送按钮，显示加载状态
    toggleSendButton(false);
    isApiCalling = true;
    
    try {
        // 创建AbortController用于取消请求
        currentAbortController = new AbortController();
        
        // 调用DeepSeek API获取流式响应
        await streamChatCompletion(userInput, aiMessageElement, (content) => {
            // 流式更新回调
            markdownContent += content;
            
            // 节流UI更新，提高性能
            const now = Date.now();
            if (now - lastUpdateTime >= updateInterval) {
                updateMessageContent(aiMessageElement, markdownContent);
                lastUpdateTime = now;
            }
        });
        
        // 最终更新一次确保所有内容显示
        updateMessageContent(aiMessageElement, markdownContent);
        aiMessageElement.classList.remove('typing');
        
    } catch (error) {
        console.error('API调用错误:', error);
        handleApiError(error, aiMessageElement);
    } finally {
        // 清理状态
        isApiCalling = false;
        currentAbortController = null;
        toggleSendButton(true);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

// 更新消息内容（优化性能）
function updateMessageContent(element, content) {
    if (marked) {
        element.innerHTML = marked.parse(content);
        applyCodeHighlighting(element);
    } else {
        element.textContent = content;
    }
    
    // 滚动到底部
    const chatWindow = document.querySelector('.chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 处理API错误
function handleApiError(error, element) {
    element.classList.remove('typing');
    
    if (error.name === 'AbortError') {
        element.textContent = '请求已取消';
    } else if (error.message.includes('401')) {
        element.textContent = 'API密钥无效，请检查配置';
    } else if (error.message.includes('429')) {
        element.textContent = '请求频率过高，请稍后再试';
    } else if (error.message.includes('500')) {
        element.textContent = '服务器内部错误，请稍后再试';
    } else if (error.message.includes('timeout')) {
        element.textContent = '请求超时，请检查网络连接';
    } else {
        element.textContent = '抱歉，发生了错误，请稍后再试';
    }
    
    showNotification('API调用失败: ' + error.message, 'error');
}

// 应用代码高亮
function applyCodeHighlighting(element) {
    if (typeof hljs !== 'undefined') {
        // 查找所有预格式化代码块并应用高亮
        element.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}

// 添加消息到聊天窗口
function appendMessage(type, content, isMarkdown = false) {
    const chatWindow = document.querySelector('.chat-window');
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(type === 'user' ? 'user-message' : 'ai-message');
    
    if (isMarkdown && marked && content) {
        messageDiv.innerHTML = marked.parse(content);
        // 应用代码高亮
        applyCodeHighlighting(messageDiv);
    } else {
        messageDiv.textContent = content;
    }
    
    chatWindow.appendChild(messageDiv);
    
    // 滚动到底部
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    return messageDiv;
}

// 切换发送按钮状态
function toggleSendButton(enabled) {
    const sendButton = document.querySelector('.input-area button');
    const textarea = document.querySelector('.input-area textarea');
    
    sendButton.disabled = !enabled;
    textarea.disabled = !enabled;
    
    if (enabled) {
        sendButton.textContent = '发送';
        textarea.focus();
    } else {
        sendButton.textContent = '等待中...';
    }
}

// 使用DeepSeek API进行流式输出
async function streamChatCompletion(prompt, outputElement, onContentUpdate) {
    // 验证API密钥
    if (!DEEPSEEK_API_KEY) {
        throw new Error('未配置有效的API密钥');
    }
    
    // 创建请求体
    const requestBody = {
        model: 'deepseek-chat',
        messages: [
            {
                role: 'system',
                content: '你是神农AI智能助手，专门解答关于中医药药材、方剂和理论知识的问题。请提供准确、专业的回答。请使用Markdown格式输出以增强可读性，包括标题、列表、表格和代码块等。对于代码，请指定语言以便正确高亮显示。'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
    };
    
    // 创建超时控制器
    const timeoutId = setTimeout(() => {
        if (currentAbortController) {
            currentAbortController.abort();
        }
    }, DEEPSEEK_API_TIMEOUT);
    
    try {
        // 发起fetch请求
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(requestBody),
            signal: currentAbortController?.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} - ${errorText}`);
        }
        
        // 验证响应类型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/event-stream')) {
            throw new Error('服务器返回了非流式响应');
        }
        
        // 获取读取器以处理流
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        
        // 逐步读取流数据
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            // 检查是否被取消
            if (currentAbortController?.signal.aborted) {
                throw new DOMException('请求被取消', 'AbortError');
            }
            
            // 解码接收到的数据
            buffer += decoder.decode(value, { stream: true });
            
            // 处理完整的行
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留不完整的行
            
            for (const line of lines) {
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ')) {
                    const jsonData = line.slice(6).trim();
                    
                    // 跳过[DONE]消息
                    if (jsonData === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(jsonData);
                        
                        // 检查是否有错误
                        if (data.error) {
                            throw new Error(`API返回错误: ${data.error.message || '未知错误'}`);
                        }
                        
                        const content = data.choices[0]?.delta?.content || '';
                        
                        if (content) {
                            onContentUpdate(content);
                        }
                        
                        // 检查是否完成
                        if (data.choices[0]?.finish_reason) {
                            return;
                        }
                    } catch (e) {
                        console.warn('解析流数据错误:', e);
                        // 继续处理其他数据，不中断整个流
                    }
                }
            }
        }
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4caf50'};
        color: white;
        border-radius: 4px;
        z-index: 1000;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// 取消当前API调用
function cancelCurrentRequest() {
    if (currentAbortController && isApiCalling) {
        currentAbortController.abort();
        isApiCalling = false;
        toggleSendButton(true);
        showNotification('请求已取消', 'info');
    }
} 
