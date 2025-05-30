// Deepseek API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
let DEEPSEEK_API_KEY = 'sk-492db840baa3414e91b99ac041e1a5d4'; // 需要从环境变量或配置文件获取

// 导入marked库用于Markdown渲染
let marked;

// 获取DOM元素
document.addEventListener('DOMContentLoaded', function() {
    const chatWindow = document.querySelector('.chat-window');
    const textarea = document.querySelector('.input-area textarea');
    const sendButton = document.querySelector('.input-area button');

    // 初始化Markdown渲染器
    initMarkdown();
    
    // 初始化API密钥（实际应用中应从安全的后端获取）
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
            breaks: true,           // 将换行符转换为<br>
            gfm: true,              // 使用Github Flavored Markdown
            headerIds: false,       // 不使用头部ID
            mangle: false,          // 不转义HTML
            sanitize: false,        // 不过滤HTML标签
            highlight: function(code, lang) {
                // 使用highlight.js进行代码高亮
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

// 初始化API密钥（实际应用中应通过后端安全获取）
function initAPIKey() {
    // 此处仅为示例，实际应用中应从后端获取密钥
    // DEEPSEEK_API_KEY = '您的API密钥';
    
    // 在生产环境中应通过后端API获取密钥，例如：
    /*
    fetch('/api/get-deepseek-key', {
        method: 'GET',
        credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(data => {
        DEEPSEEK_API_KEY = data.apiKey;
    })
    .catch(error => {
        console.error('获取API密钥失败:', error);
    });
    */
    
    // 临时测试用密钥（仅用于开发环境）
    DEEPSEEK_API_KEY = 'sk-492db840baa3414e91b99ac041e1a5d4';
}

// 处理发送消息
async function handleSendMessage() {
    const textarea = document.querySelector('.input-area textarea');
    const chatWindow = document.querySelector('.chat-window');
    
    const userInput = textarea.value.trim();
    
    // 如果没有输入，直接返回
    if (userInput === '') return;
    
    // 清空输入框
    textarea.value = '';
    
    // 添加用户消息到聊天窗口
    appendMessage('user', userInput, false);
    
    // 添加AI消息容器，准备接收流式响应
    const aiMessageElement = appendMessage('ai', '', true);
    // 添加打字动画效果
    aiMessageElement.classList.add('typing');
    
    // 保存原始内容，用于流式更新
    let markdownContent = '';
    
    // 禁用发送按钮，显示加载状态
    toggleSendButton(false);
    
    try {
        // 调用DeepSeek API获取流式响应
        await streamChatCompletion(userInput, aiMessageElement, (content) => {
            // 流式更新回调，累加markdown内容
            markdownContent += content;
            // 使用marked渲染markdown内容
            if (marked) {
                aiMessageElement.innerHTML = marked.parse(markdownContent);
                // 应用代码高亮
                applyCodeHighlighting(aiMessageElement);
            } else {
                aiMessageElement.textContent = markdownContent;
            }
        });
        
        // 移除打字动画效果
        aiMessageElement.classList.remove('typing');
        
        // 最终应用一次代码高亮，确保所有代码块都被高亮
        applyCodeHighlighting(aiMessageElement);
    } catch (error) {
        console.error('API调用错误:', error);
        aiMessageElement.textContent = '抱歉，发生了错误，请稍后再试。';
        aiMessageElement.classList.remove('typing');
    } finally {
        // 启用发送按钮
        toggleSendButton(true);
        
        // 滚动到底部
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
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
    if (!DEEPSEEK_API_KEY) {
        outputElement.textContent = '错误：未配置API密钥';
        outputElement.classList.remove('typing');
        return;
    }
    
    // 创建请求体
    const requestBody = {
        model: 'deepseek-chat', // 根据DeepSeek提供的模型名称调整
        messages: [
            {
                role: 'system',
                content: '你是兵智视界智能助手，专门解答关于武器装备的问题。请提供准确、专业的回答。请使用Markdown格式输出以增强可读性，包括标题、列表、表格和代码块等。对于代码，请指定语言以便正确高亮显示。'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        stream: true
    };
    
    try {
        // 发起fetch请求
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        // 获取读取器以处理流
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        // 逐步读取流数据
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            // 解码接收到的数据
            const chunk = decoder.decode(value, { stream: true });
            
            // 处理流式数据（格式可能需要根据DeepSeek API的具体实现调整）
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonData = line.slice(6).trim();
                    
                    // 跳过[DONE]消息
                    if (jsonData === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(jsonData);
                        const content = data.choices[0]?.delta?.content || '';
                        
                        if (content) {
                            // 调用回调函数更新内容
                            onContentUpdate(content);
                            
                            // 滚动到底部
                            const chatWindow = document.querySelector('.chat-window');
                            chatWindow.scrollTop = chatWindow.scrollHeight;
                        }
                    } catch (e) {
                        console.error('解析流数据错误:', e);
                    }
                }
            }
        }
    } catch (error) {
        console.error('流处理错误:', error);
        throw error;
    }
} 