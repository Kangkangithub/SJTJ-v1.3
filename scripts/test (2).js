// 军事测验 JavaScript 逻辑
document.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const quizSelection = document.getElementById('quizSelection');
    const quizContainer = document.getElementById('quizContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    
    const categoryItems = document.querySelectorAll('.category-item');
    const difficultyOptions = document.querySelectorAll('.difficulty-option');
    const startQuizButton = document.getElementById('startQuizButton');
    const questionCountElem = document.getElementById('questionCount');
    const timeLimitElem = document.getElementById('timeLimit');
    
    const currentCategoryElem = document.getElementById('currentCategory');
    const currentDifficultyElem = document.getElementById('currentDifficulty');
    const timerElem = document.getElementById('timer');
    const currentQuestionNumElem = document.getElementById('currentQuestionNum');
    const totalQuestionsElem = document.getElementById('totalQuestions');
    const progressBarElem = document.getElementById('progressBar');
    
    const questionTextElem = document.getElementById('questionText');
    const questionImageContainer = document.getElementById('questionImageContainer');
    const optionsContainer = document.getElementById('optionsContainer');
    const nextButton = document.getElementById('nextButton');
    
    const hintButton = document.getElementById('hintButton');
    const hintContent = document.getElementById('hintContent');
    const hintCountElem = document.querySelector('.hint-count');
    
    const scorePercentageElem = document.getElementById('scorePercentage');
    const scoreTextElem = document.getElementById('scoreText');
    const timeUsedElem = document.getElementById('timeUsed');
    const badgesContainer = document.getElementById('badgesContainer');
    const reviewList = document.getElementById('reviewList');
    
    const restartButton = document.getElementById('restartButton');
    const shareButton = document.getElementById('shareButton');
    const viewLeaderboardButton = document.getElementById('viewLeaderboardButton');
    const backToResultsButton = document.getElementById('backToResultsButton');
    const newQuizButton = document.getElementById('newQuizButton');
    
    const leaderboardTabs = document.querySelectorAll('.tab-button');
    const categoryFilter = document.getElementById('categoryFilter');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const leaderboardTableBody = document.getElementById('leaderboardTableBody');
    
    // 测验状态
    let quizState = {
        category: null,
        difficulty: null,
        questions: [],
        currentQuestion: 0,
        score: 0,
        answers: [],
        hints: 3,
        startTime: null,
        endTime: null,
        timeLimit: 600, // 默认10分钟
        timer: null
    };
    
    // 类别和难度对应的中文名
    const categoryNames = {
        'weapons': '武器装备',
        'history': '军事历史',
        'strategy': '战略战术',
        'countries': '各国军力'
    };
    
    const difficultyNames = {
        'easy': '新兵',
        'medium': '军士',
        'hard': '将军'
    };
    
    // 难度对应的问题数量和时间限制
    const difficultySettings = {
        'easy': { questions: 5, timeLimit: 300 }, // 5题, 5分钟
        'medium': { questions: 10, timeLimit: 600 }, // 10题, 10分钟
        'hard': { questions: 15, timeLimit: 900 } // 15题, 15分钟
    };
    
    // 初始化类别选择
    categoryItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除其他选中状态
            categoryItems.forEach(i => i.classList.remove('selected'));
            // 添加当前选中状态
            this.classList.add('selected');
            
            quizState.category = this.dataset.category;
            updateStartButton();
        });
    });
    
    // 初始化难度选择
    difficultyOptions.forEach(option => {
        option.addEventListener('click', function() {
            // 移除其他选中状态
            difficultyOptions.forEach(o => o.classList.remove('selected'));
            // 添加当前选中状态
            this.classList.add('selected');
            
            quizState.difficulty = this.dataset.difficulty;
            
            // 更新问题数量和时间限制
            const settings = difficultySettings[quizState.difficulty];
            questionCountElem.textContent = `${settings.questions}个问题`;
            timeLimitElem.textContent = settings.timeLimit / 60;
            quizState.timeLimit = settings.timeLimit;
            
            updateStartButton();
        });
    });
    
    // 更新开始按钮状态
    function updateStartButton() {
        if (quizState.category && quizState.difficulty) {
            startQuizButton.disabled = false;
        } else {
            startQuizButton.disabled = true;
        }
    }
    
    // 开始测验
    startQuizButton.addEventListener('click', function() {
        startQuiz();
    });
    
    // 开始测验逻辑
    function startQuiz() {
        // 加载问题
        loadQuestions(quizState.category, quizState.difficulty, function(questions) {
            // 设置测验状态
            quizState.questions = questions;
            quizState.currentQuestion = 0;
            quizState.score = 0;
            quizState.answers = [];
            quizState.hints = 3;
            quizState.startTime = new Date();
            
            // 更新UI
            currentCategoryElem.textContent = categoryNames[quizState.category];
            currentDifficultyElem.textContent = difficultyNames[quizState.difficulty];
            totalQuestionsElem.textContent = quizState.questions.length;
            hintCountElem.textContent = quizState.hints;
            
            // 切换到测验页面
            quizSelection.style.display = 'none';
            quizContainer.style.display = 'block';
            
            // 显示第一个问题
            showQuestion(0);
            
            // 开始计时
            startTimer();
        });
    }
    
    // 加载问题数据
    function loadQuestions(category, difficulty, callback) {
        // 模拟数据 - 实际应用中应从服务器获取
        const mockQuestions = generateMockQuestions(category, difficulty);
        setTimeout(() => callback(mockQuestions), 500);
    }
    
    // 生成模拟问题数据
    function generateMockQuestions(category, difficulty) {
        const questionCount = difficultySettings[difficulty].questions;
        let questions = [];
        
        // 根据类别生成不同领域的问题
        switch (category) {
            case 'weapons':
                questions = [
                    {
                        question: "下列哪种武器被称为'坦克杀手'?",
                        options: ["RPG-7", "AK-47", "M16", "巴雷特狙击步枪"],
                        correctAnswer: 0,
                        image: "images/weapons/rpg7.jpg",
                        hint: "这是一种便携式反坦克火箭筒，由苏联研制"
                    },
                    {
                        question: "AK-47步枪的设计者是谁?",
                        options: ["米哈伊尔·卡拉什尼科夫", "尤金·斯托纳", "约翰·勃朗宁", "理查德·加特林"],
                        correctAnswer: 0,
                        hint: "这位设计师是苏联人，他的名字与这款武器密切相关"
                    },
                    {
                        question: "第一代喷气式战斗机在哪场战争中首次大规模使用?",
                        options: ["一战", "二战", "朝鲜战争", "越南战争"],
                        correctAnswer: 2,
                        hint: "这场战争发生在20世纪50年代初"
                    },
                    {
                        question: "下列哪种坦克参加了第二次世界大战?",
                        options: ["M1艾布拉姆斯", "T-34", "豹2主战坦克", "梅卡瓦"],
                        correctAnswer: 1,
                        image: "images/weapons/t34.jpg",
                        hint: "这是苏联在二战期间生产的最著名坦克"
                    },
                    {
                        question: "以下哪种导弹是美国研制的空对空导弹?",
                        options: ["响尾蛇", "鹰击", "三叉戟", "宙斯盾"],
                        correctAnswer: 0,
                        hint: "它的名字来源于一种蛇"
                    },
                    {
                        question: "中国最新的第五代战斗机是哪一款?",
                        options: ["歼-10", "歼-16", "歼-20", "歼-31"],
                        correctAnswer: 2,
                        image: "images/weapons/j20.jpg",
                        hint: "这款战机与美国F-22具有相似的隐身特性"
                    },
                    {
                        question: "世界上第一艘核动力航空母舰是哪一艘?",
                        options: ["企业号", "尼米兹号", "福特级", "戴高乐号"],
                        correctAnswer: 0,
                        hint: "这艘航母服役于1961年"
                    },
                    {
                        question: "下列哪种武器不是狙击步枪?",
                        options: ["SVD", "AWM", "M4A1", "巴雷特M82"],
                        correctAnswer: 2,
                        hint: "这是一种突击步枪，而不是狙击步枪"
                    },
                    {
                        question: "以下哪种武器系统是用于防空的?",
                        options: ["托马霍克", "爱国者", "阿帕奇", "亚伯拉罕斯"],
                        correctAnswer: 1,
                        hint: "这是美国研发的地对空导弹系统"
                    },
                    {
                        question: "下列哪种潜艇属于核动力弹道导弹潜艇?",
                        options: ["基洛级", "洛杉矶级", "俄亥俄级", "阿库拉级"],
                        correctAnswer: 2,
                        image: "images/weapons/ohio.jpg",
                        hint: "这种潜艇是美国海军的战略核力量组成部分"
                    },
                    {
                        question: "M16步枪的主要制造国是?",
                        options: ["俄罗斯", "美国", "德国", "以色列"],
                        correctAnswer: 1,
                        hint: "这是美军的标准步枪"
                    },
                    {
                        question: "以下哪种火炮口径最大?",
                        options: ["105毫米榴弹炮", "120毫米坦克炮", "155毫米榴弹炮", "76毫米山炮"],
                        correctAnswer: 2,
                        hint: "这是北约标准的大口径火炮"
                    }
                ];
                break;
                
            case 'history':
                questions = [
                    {
                        question: "诺曼底登陆发生在哪一年?",
                        options: ["1942年", "1943年", "1944年", "1945年"],
                        correctAnswer: 2,
                        image: "images/history/normandy.jpg",
                        hint: "这次行动的代号是'霸王行动'，发生在二战后期"
                    },
                    {
                        question: "古代中国四大名著中，哪一部与军事最为相关?",
                        options: ["红楼梦", "西游记", "水浒传", "三国演义"],
                        correctAnswer: 3,
                        hint: "这部小说描述了东汉末年的军阀混战"
                    },
                    {
                        question: "西方军事史上最早的军事著作是?",
                        options: ["《战争论》", "《孙子兵法》", "《论战争的艺术》", "《伯罗奔尼撒战争史》"],
                        correctAnswer: 3,
                        hint: "这部作品由古希腊历史学家修昔底德所著"
                    },
                    {
                        question: "第二次世界大战的转折点战役是?",
                        options: ["斯大林格勒战役", "中途岛海战", "诺曼底登陆", "敦刻尔克大撤退"],
                        correctAnswer: 0,
                        image: "images/history/stalingrad.jpg",
                        hint: "这场战役挫败了德国在东线的进攻"
                    },
                    {
                        question: "中国抗日战争爆发的标志性事件是?",
                        options: ["九一八事变", "七七事变", "南京大屠杀", "平型关大捷"],
                        correctAnswer: 1,
                        hint: "这一事件发生在卢沟桥"
                    },
                    {
                        question: "《孙子兵法》的作者是?",
                        options: ["孙膑", "孙武", "吴起", "诸葛亮"],
                        correctAnswer: 1,
                        hint: "他生活在春秋时期的吴国"
                    },
                    {
                        question: "被称为'炮兵之神'的拿破仑参与的最后一场战役是?",
                        options: ["奥斯特里茨战役", "滑铁卢战役", "波罗底诺战役", "莱比锡战役"],
                        correctAnswer: 1,
                        hint: "这场战役导致了拿破仑的最终失败"
                    },
                    {
                        question: "朝鲜战争爆发的时间是?",
                        options: ["1949年", "1950年", "1951年", "1953年"],
                        correctAnswer: 1,
                        hint: "这场战争在20世纪50年代初爆发"
                    },
                    {
                        question: "中国古代哪位军事家提出'知己知彼，百战不殆'?",
                        options: ["孙武", "吴起", "孙膑", "韩信"],
                        correctAnswer: 0,
                        hint: "他是《孙子兵法》的作者"
                    },
                    {
                        question: "第一次世界大战的导火索是?",
                        options: ["德国入侵波兰", "奥匈帝国皇储被刺杀", "凡尔赛条约", "俄国革命"],
                        correctAnswer: 1,
                        hint: "这一事件发生在萨拉热窝"
                    },
                    {
                        question: "冷战正式结束的标志是?",
                        options: ["柏林墙倒塌", "古巴导弹危机解除", "苏联解体", "华沙条约组织解散"],
                        correctAnswer: 2,
                        hint: "这一事件发生在1991年"
                    },
                    {
                        question: "二战期间，哪次会议决定了战后世界格局?",
                        options: ["开罗会议", "雅尔塔会议", "波茨坦会议", "慕尼黑会议"],
                        correctAnswer: 1,
                        hint: "这次会议由美、英、苏三国领导人参加"
                    }
                ];
                break;
                
            case 'strategy':
                questions = [
                    {
                        question: "以下哪种战争不属于非对称战争?",
                        options: ["游击战", "恐怖袭击", "常规战争", "网络战"],
                        correctAnswer: 2,
                        hint: "非对称战争指的是实力悬殊双方之间的冲突"
                    },
                    {
                        question: "冷战时期，美苏采取的战略思想是?",
                        options: ["闪电战", "持久战", "相互确保摧毁", "全球反恐"],
                        correctAnswer: 2,
                        hint: "这一战略基于核威慑理论"
                    },
                    {
                        question: "下列哪位军事家提出了'不战而屈人之兵'的思想?",
                        options: ["克劳塞维茨", "拿破仑", "毛泽东", "孙武"],
                        correctAnswer: 3,
                        hint: "这一思想出自《孙子兵法》"
                    },
                    {
                        question: "游击战的核心思想是什么?",
                        options: ["速战速决", "避实就虚", "正面对抗", "火力压制"],
                        correctAnswer: 1,
                        hint: "这种战术强调灵活性和出其不意"
                    },
                    {
                        question: "二战时期，闪电战主要应用于哪个国家的军事行动中?",
                        options: ["美国", "英国", "德国", "苏联"],
                        correctAnswer: 2,
                        hint: "这个国家在战争初期迅速占领了欧洲大部分地区"
                    },
                    {
                        question: "《战争论》的作者是哪国军事家?",
                        options: ["法国", "德国", "英国", "俄国"],
                        correctAnswer: 1,
                        hint: "作者是卡尔·冯·克劳塞维茨"
                    },
                    {
                        question: "现代战争中，C4ISR系统指的是什么?",
                        options: ["坦克装甲系统", "指挥控制通信计算机情报监视侦察", "航空母舰作战系统", "核打击能力"],
                        correctAnswer: 1,
                        hint: "这是现代军事信息化的核心系统"
                    },
                    {
                        question: "下列哪种战术不属于海战战术?",
                        options: ["横队战术", "纵深突破", "T字战术", "舰载机打击"],
                        correctAnswer: 1,
                        hint: "这种战术主要用于陆地战争"
                    },
                    {
                        question: "军事上的'中心论'强调什么?",
                        options: ["打击敌人的政治中心", "控制战场中心区域", "摧毁敌人的指挥中心", "攻击敌人的重心"],
                        correctAnswer: 3,
                        hint: "这一理论强调找到并攻击敌人的关键弱点"
                    },
                    {
                        question: "现代战争中的'信息战'主要目的是什么?",
                        options: ["获取敌方情报", "控制战场态势", "影响民意", "以上都是"],
                        correctAnswer: 3,
                        hint: "信息战是多维度的战争形式"
                    },
                    {
                        question: "在军事理论中，'不对称战略'的核心是什么?",
                        options: ["以强制强", "以弱胜强", "速战速决", "持久作战"],
                        correctAnswer: 1,
                        hint: "这种战略强调利用特殊手段克服实力差距"
                    },
                    {
                        question: "现代联合作战的特点是什么?",
                        options: ["单一兵种作战", "陆海空协同", "仅限于大规模战争", "无需指挥协调"],
                        correctAnswer: 1,
                        hint: "这种作战方式强调多军种的协同配合"
                    }
                ];
                break;
                
            case 'countries':
                questions = [
                    {
                        question: "下列哪个国家不是北约创始成员国?",
                        options: ["美国", "英国", "德国", "法国"],
                        correctAnswer: 2,
                        hint: "这个国家在二战后被分为东西两部分"
                    },
                    {
                        question: "全球军费支出最高的国家是?",
                        options: ["中国", "俄罗斯", "美国", "英国"],
                        correctAnswer: 2,
                        hint: "这个国家拥有全球最多的海外军事基地"
                    },
                    {
                        question: "下列哪个国家拥有核武器?",
                        options: ["日本", "德国", "印度", "澳大利亚"],
                        correctAnswer: 2,
                        hint: "这个国家在1998年进行了核试验"
                    },
                    {
                        question: "哪个国家的常备军人数最多?",
                        options: ["美国", "中国", "印度", "俄罗斯"],
                        correctAnswer: 1,
                        hint: "这个国家是世界人口最多的国家"
                    },
                    {
                        question: "以色列的主要军事盟友是?",
                        options: ["俄罗斯", "伊朗", "美国", "沙特阿拉伯"],
                        correctAnswer: 2,
                        hint: "这个国家每年向以色列提供大量军事援助"
                    },
                    {
                        question: "下列哪个国家不是联合国安理会常任理事国?",
                        options: ["中国", "俄罗斯", "法国", "日本"],
                        correctAnswer: 3,
                        hint: "安理会有五个常任理事国"
                    },
                    {
                        question: "哪个国家是北约成员国中军费支出占GDP比例最高的国家之一?",
                        options: ["德国", "法国", "美国", "希腊"],
                        correctAnswer: 3,
                        hint: "这个国家位于地中海东部"
                    },
                    {
                        question: "以下哪个国家不是上海合作组织成员国?",
                        options: ["中国", "俄罗斯", "印度", "日本"],
                        correctAnswer: 3,
                        hint: "这个国家是亚洲发达经济体"
                    },
                    {
                        question: "哪个国家拥有世界上最大的海军陆战队?",
                        options: ["英国", "中国", "俄罗斯", "美国"],
                        correctAnswer: 3,
                        hint: "这支部队有着悠久的历史，成立于1775年"
                    },
                    {
                        question: "哪个国家拥有'萨德'反导系统?",
                        options: ["中国", "韩国", "日本", "朝鲜"],
                        correctAnswer: 1,
                        hint: "这个系统由美国部署在该国，引起了周边国家的关注"
                    },
                    {
                        question: "下列哪个国家军队实行义务兵役制?",
                        options: ["美国", "英国", "韩国", "加拿大"],
                        correctAnswer: 2,
                        hint: "这个国家与朝鲜有边界"
                    },
                    {
                        question: "冷战时期，华沙条约组织的主导国是?",
                        options: ["苏联", "波兰", "捷克斯洛伐克", "东德"],
                        correctAnswer: 0,
                        hint: "这个国家是当时的社会主义阵营领导者"
                    }
                ];
                break;
        }
        
        // 根据所需问题数量随机选择问题
        if (questions.length > questionCount) {
            questions = shuffleArray(questions).slice(0, questionCount);
        }
        
        return questions;
    }
    
    // 数组随机排序（Fisher-Yates 洗牌算法）
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    // 显示问题
    function showQuestion(index) {
        if (index >= quizState.questions.length) {
            endQuiz();
            return;
        }
        
        const question = quizState.questions[index];
        
        // 更新问题文本
        questionTextElem.textContent = question.question;
        
        // 更新问题图片（如果有）
        if (question.image) {
            questionImageContainer.innerHTML = `<img src="${question.image}" alt="问题图片">`;
            questionImageContainer.style.display = 'block';
        } else {
            questionImageContainer.style.display = 'none';
        }
        
        // 更新选项
        optionsContainer.innerHTML = '';
        question.options.forEach((option, i) => {
            const optionElem = document.createElement('div');
            optionElem.className = 'quiz-option';
            optionElem.textContent = option;
            optionElem.dataset.index = i;
            
            optionElem.addEventListener('click', function() {
                selectOption(this, i);
            });
            
            optionsContainer.appendChild(optionElem);
        });
        
        // 更新问题进度
        currentQuestionNumElem.textContent = index + 1;
        progressBarElem.style.width = `${((index + 1) / quizState.questions.length) * 100}%`;
        
        // 重置提示内容
        hintContent.style.display = 'none';
        
        // 禁用下一题按钮，直到选择答案
        nextButton.style.display = 'none';
    }
    
    // 选择选项
    function selectOption(optionElem, optionIndex) {
        const currentQuestion = quizState.questions[quizState.currentQuestion];
        const options = document.querySelectorAll('.quiz-option');
        
        // 移除所有选项的选中状态
        options.forEach(opt => opt.classList.remove('selected', 'correct', 'wrong'));
        
        // 添加选中状态
        optionElem.classList.add('selected');
        
        // 检查答案
        const isCorrect = optionIndex === currentQuestion.correctAnswer;
        
        // 记录答案
        quizState.answers.push({
            question: currentQuestion.question,
            selectedAnswer: optionIndex,
            correctAnswer: currentQuestion.correctAnswer,
            isCorrect: isCorrect
        });
        
        // 显示对错
        setTimeout(() => {
            if (isCorrect) {
                optionElem.classList.add('correct');
                quizState.score++;
            } else {
                optionElem.classList.add('wrong');
                options[currentQuestion.correctAnswer].classList.add('correct');
            }
            
            // 显示下一题按钮
            nextButton.style.display = 'block';
        }, 500);
    }
    
    // 下一题
    nextButton.addEventListener('click', function() {
        quizState.currentQuestion++;
        showQuestion(quizState.currentQuestion);
    });
    
    // 使用提示
    hintButton.addEventListener('click', function() {
        if (quizState.hints <= 0) return;
        
        const currentQuestion = quizState.questions[quizState.currentQuestion];
        
        if (currentQuestion.hint) {
            quizState.hints--;
            hintCountElem.textContent = quizState.hints;
            
            hintContent.textContent = currentQuestion.hint;
            hintContent.style.display = 'block';
        }
    });
    
    // 开始计时器
    function startTimer() {
        let timeLeft = quizState.timeLimit;
        updateTimerDisplay(timeLeft);
        
        quizState.timer = setInterval(function() {
            timeLeft--;
            updateTimerDisplay(timeLeft);
            
            if (timeLeft <= 0) {
                clearInterval(quizState.timer);
                endQuiz();
            }
        }, 1000);
    }
    
    // 更新计时器显示
    function updateTimerDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerElem.textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
    
    // 结束测验
    function endQuiz() {
        clearInterval(quizState.timer);
        quizState.endTime = new Date();
        
        // 计算成绩
        const scorePercentage = Math.round((quizState.score / quizState.questions.length) * 100);
        const timeUsed = Math.round((quizState.endTime - quizState.startTime) / 1000);
        const minutes = Math.floor(timeUsed / 60);
        const seconds = timeUsed % 60;
        
        // 更新UI
        scorePercentageElem.textContent = `${scorePercentage}%`;
        scoreTextElem.textContent = `您的得分：${quizState.score}/${quizState.questions.length}`;
        timeUsedElem.textContent = `用时：${minutes}分${seconds}秒`;
        
        // 设置勋章
        setBadges(scorePercentage);
        
        // 显示答题回顾
        showAnswerReview();
        
        // 切换到结果页面
        quizContainer.style.display = 'none';
        resultsContainer.style.display = 'block';
        
        // 保存记录到排行榜
        saveToLeaderboard();
    }
    
    // 设置勋章
    function setBadges(scorePercentage) {
        badgesContainer.innerHTML = '';
        
        let badges = [];
        
        // 根据得分设置勋章
        if (scorePercentage >= 90) {
            badges.push({
                icon: 'fa-medal',
                name: '精英勋章'
            });
        } else if (scorePercentage >= 70) {
            badges.push({
                icon: 'fa-award',
                name: '优秀勋章'
            });
        } else if (scorePercentage >= 50) {
            badges.push({
                icon: 'fa-certificate',
                name: '合格勋章'
            });
        }
        
        // 根据难度设置勋章
        if (quizState.difficulty === 'hard') {
            badges.push({
                icon: 'fa-crown',
                name: '挑战者勋章'
            });
        }
        
        // 根据时间设置勋章
        const totalTime = Math.round((quizState.endTime - quizState.startTime) / 1000);
        if (totalTime < quizState.timeLimit / 2) {
            badges.push({
                icon: 'fa-bolt',
                name: '闪电勋章'
            });
        }
        
        // 显示勋章
        badges.forEach(badge => {
            const badgeElem = document.createElement('div');
            badgeElem.className = 'badge-item';
            badgeElem.innerHTML = `
                <div class="badge-icon">
                    <i class="fas ${badge.icon}"></i>
                </div>
                <div class="badge-name">${badge.name}</div>
            `;
            badgesContainer.appendChild(badgeElem);
        });
        
        // 如果没有勋章，显示鼓励信息
        if (badges.length === 0) {
            badgesContainer.innerHTML = '<p>继续努力，争取获得勋章！</p>';
        }
    }
    
    // 显示答题回顾
    function showAnswerReview() {
        reviewList.innerHTML = '';
        
        quizState.answers.forEach((answer, index) => {
            const reviewItem = document.createElement('div');
            reviewItem.className = 'review-item';
            
            // 获取选项文本
            const question = quizState.questions[index];
            const selectedOptionText = question.options[answer.selectedAnswer];
            const correctOptionText = question.options[answer.correctAnswer];
            
            reviewItem.innerHTML = `
                <div class="review-question">${index + 1}. ${answer.question}</div>
                <div class="review-answer ${answer.isCorrect ? 'correct' : 'wrong'}">
                    <i class="fas ${answer.isCorrect ? 'fa-check' : 'fa-times'}"></i>
                    您的答案: ${selectedOptionText}
                    ${!answer.isCorrect ? `<br><span style="margin-left: 20px;">正确答案: ${correctOptionText}</span>` : ''}
                </div>
            `;
            
            reviewList.appendChild(reviewItem);
        });
    }
    
    // 保存记录到排行榜
    function saveToLeaderboard() {
        // 这里应连接后端API，保存记录到数据库
        // 以下为模拟数据
        const leaderboardEntry = {
            user: "当前用户",
            category: quizState.category,
            difficulty: quizState.difficulty,
            score: quizState.score,
            total: quizState.questions.length,
            time: Math.round((quizState.endTime - quizState.startTime) / 1000),
            date: new Date()
        };
        
        // 模拟添加到本地排行榜
        let leaderboard = JSON.parse(localStorage.getItem('quizLeaderboard') || '[]');
        leaderboard.push(leaderboardEntry);
        localStorage.setItem('quizLeaderboard', JSON.stringify(leaderboard));
    }
    
    // 重新测验
    restartButton.addEventListener('click', function() {
        resultsContainer.style.display = 'none';
        quizSelection.style.display = 'block';
    });
    
    // 分享成绩
    shareButton.addEventListener('click', function() {
        // 实际应用中可实现社交分享功能
        alert('分享功能正在开发中...');
    });
    
    // 查看排行榜
    viewLeaderboardButton.addEventListener('click', function() {
        resultsContainer.style.display = 'none';
        leaderboardContainer.style.display = 'block';
        loadLeaderboard();
    });
    
    // 从排行榜返回结果
    backToResultsButton.addEventListener('click', function() {
        leaderboardContainer.style.display = 'none';
        resultsContainer.style.display = 'block';
    });
    
    // 开始新测验
    newQuizButton.addEventListener('click', function() {
        leaderboardContainer.style.display = 'none';
        quizSelection.style.display = 'block';
    });
    
    // 切换排行榜标签
    leaderboardTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            leaderboardTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loadLeaderboard();
        });
    });
    
    // 加载排行榜
    function loadLeaderboard() {
        const timeRange = document.querySelector('.tab-button.active').dataset.tab;
        const category = categoryFilter.value;
        const difficulty = difficultyFilter.value;
        
        // 从本地存储获取排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem('quizLeaderboard') || '[]');
        
        // 根据标签筛选
        if (timeRange === 'weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            leaderboard = leaderboard.filter(entry => new Date(entry.date) >= weekAgo);
        } else if (timeRange === 'monthly') {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            leaderboard = leaderboard.filter(entry => new Date(entry.date) >= monthAgo);
        }
        
        // 根据类别筛选
        if (category !== 'all') {
            leaderboard = leaderboard.filter(entry => entry.category === category);
        }
        
        // 根据难度筛选
        if (difficulty !== 'all') {
            leaderboard = leaderboard.filter(entry => entry.difficulty === difficulty);
        }
        
        // 按得分和时间排序
        leaderboard.sort((a, b) => {
            // 首先按百分比得分排序
            const scoreA = a.score / a.total;
            const scoreB = b.score / b.total;
            
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }
            
            // 如果得分相同，按时间排序
            return a.time - b.time;
        });
        
        // 显示排行榜
        displayLeaderboard(leaderboard);
    }
    
    // 显示排行榜
    function displayLeaderboard(leaderboard) {
        leaderboardTableBody.innerHTML = '';
        
        if (leaderboard.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="7" style="text-align: center;">暂无数据</td>';
            leaderboardTableBody.appendChild(emptyRow);
            return;
        }
        
        leaderboard.forEach((entry, index) => {
            const row = document.createElement('tr');
            
            // 计算得分百分比
            const scorePercentage = Math.round((entry.score / entry.total) * 100);
            
            // 计算用时
            const minutes = Math.floor(entry.time / 60);
            const seconds = entry.time % 60;
            
            // 格式化日期
            const date = new Date(entry.date);
            const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            
            let rankClass = '';
            if (index === 0) rankClass = 'top-1';
            else if (index === 1) rankClass = 'top-2';
            else if (index === 2) rankClass = 'top-3';
            
            row.innerHTML = `
                <td><span class="rank ${rankClass}">${index + 1}</span></td>
                <td>${entry.user}</td>
                <td>${categoryNames[entry.category]}</td>
                <td>${difficultyNames[entry.difficulty]}</td>
                <td>${entry.score}/${entry.total} (${scorePercentage}%)</td>
                <td>${minutes}分${seconds}秒</td>
                <td>${formattedDate}</td>
            `;
            
            leaderboardTableBody.appendChild(row);
        });
    }
    
    // 筛选排行榜
    categoryFilter.addEventListener('change', loadLeaderboard);
    difficultyFilter.addEventListener('change', loadLeaderboard);
}); 