document.addEventListener('DOMContentLoaded', function() {
  const API_BASE = 'http://localhost:3001/api';
  const token = localStorage.getItem('authToken');

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

  const categoryNames = {
    herbs: '药材分类',
    formulas: '方剂组成',
    properties: '性味归经',
    regions: '道地产区'
  };

  const difficultyNames = {
    easy: '入门',
    medium: '进阶',
    hard: '专业'
  };

  const difficultySettings = {
    easy: { questions: 5, timeLimit: 300 },
    medium: { questions: 10, timeLimit: 600 },
    hard: { questions: 15, timeLimit: 900 }
  };

  const quizState = {
    category: null,
    difficulty: null,
    questions: [],
    currentQuestion: 0,
    score: 0,
    answers: [],
    hints: 3,
    startTime: null,
    endTime: null,
    timeLimit: 600,
    timer: null,
    selectedCurrent: false
  };

  categoryItems.forEach(item => {
    item.addEventListener('click', function() {
      categoryItems.forEach(i => i.classList.remove('selected'));
      this.classList.add('selected');
      quizState.category = this.dataset.category;
      updateStartButton();
    });
  });

  difficultyOptions.forEach(option => {
    option.addEventListener('click', function() {
      difficultyOptions.forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      quizState.difficulty = this.dataset.difficulty;
      const settings = difficultySettings[quizState.difficulty];
      questionCountElem.textContent = `${settings.questions} 个问题`;
      timeLimitElem.textContent = settings.timeLimit / 60;
      quizState.timeLimit = settings.timeLimit;
      updateStartButton();
    });
  });

  startQuizButton.addEventListener('click', startQuiz);
  nextButton.addEventListener('click', () => {
    quizState.currentQuestion++;
    showQuestion(quizState.currentQuestion);
  });
  hintButton.addEventListener('click', showHint);
  restartButton.addEventListener('click', resetToSelection);
  newQuizButton.addEventListener('click', resetToSelection);
  backToResultsButton.addEventListener('click', function() {
    leaderboardContainer.style.display = 'none';
    resultsContainer.style.display = 'block';
  });
  viewLeaderboardButton.addEventListener('click', function() {
    resultsContainer.style.display = 'none';
    leaderboardContainer.style.display = 'block';
    loadLeaderboard();
  });
  shareButton.addEventListener('click', function() {
    alert('分享功能暂不可用。');
  });
  leaderboardTabs.forEach(tab => tab.addEventListener('click', function() {
    leaderboardTabs.forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    loadLeaderboard();
  }));
  categoryFilter.addEventListener('change', loadLeaderboard);
  difficultyFilter.addEventListener('change', loadLeaderboard);

  function updateStartButton() {
    startQuizButton.disabled = !(quizState.category && quizState.difficulty);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new Error(json.message || '请求失败');
    }
    return json.data;
  }

  async function startQuiz() {
    try {
      startQuizButton.disabled = true;
      startQuizButton.textContent = '加载题目中...';
      const data = await api(`/quiz/questions?category=${encodeURIComponent(quizState.category)}&difficulty=${encodeURIComponent(quizState.difficulty)}`);
      if (!data.questions || !data.questions.length) {
        alert('暂无可用题目。');
        return;
      }

      quizState.questions = data.questions;
      quizState.currentQuestion = 0;
      quizState.score = 0;
      quizState.answers = [];
      quizState.hints = 3;
      quizState.startTime = new Date();
      quizState.timeLimit = data.settings?.timeLimit || difficultySettings[quizState.difficulty].timeLimit;

      currentCategoryElem.textContent = data.categoryLabel || categoryNames[quizState.category] || quizState.category;
      currentDifficultyElem.textContent = difficultyNames[quizState.difficulty] || quizState.difficulty;
      totalQuestionsElem.textContent = quizState.questions.length;
      hintCountElem.textContent = quizState.hints;
      quizSelection.style.display = 'none';
      quizContainer.style.display = 'block';
      showQuestion(0);
      startTimer();
    } catch (error) {
      alert(`加载测评失败：${error.message}`);
    } finally {
      startQuizButton.textContent = '开始测评';
      updateStartButton();
    }
  }

  function showQuestion(index) {
    if (index >= quizState.questions.length) {
      endQuiz();
      return;
    }

    const question = quizState.questions[index];
    quizState.selectedCurrent = false;
    questionTextElem.textContent = question.question;
    questionImageContainer.style.display = 'none';
    questionImageContainer.innerHTML = '';
    optionsContainer.innerHTML = '';

    question.options.forEach((option, i) => {
      const optionElem = document.createElement('button');
      optionElem.type = 'button';
      optionElem.className = 'quiz-option';
      optionElem.textContent = option;
      optionElem.dataset.index = i;
      optionElem.addEventListener('click', () => selectOption(optionElem, i));
      optionsContainer.appendChild(optionElem);
    });

    currentQuestionNumElem.textContent = index + 1;
    progressBarElem.style.width = `${((index + 1) / quizState.questions.length) * 100}%`;
    hintContent.style.display = 'none';
    nextButton.style.display = 'none';
  }

  function selectOption(optionElem, optionIndex) {
    if (quizState.selectedCurrent) return;
    quizState.selectedCurrent = true;

    const currentQuestion = quizState.questions[quizState.currentQuestion];
    const options = document.querySelectorAll('.quiz-option');
    const isCorrect = optionIndex === currentQuestion.correctAnswer;

    options.forEach(opt => opt.classList.remove('selected', 'correct', 'wrong'));
    optionElem.classList.add('selected');
    if (isCorrect) {
      optionElem.classList.add('correct');
      quizState.score++;
    } else {
      optionElem.classList.add('wrong');
      options[currentQuestion.correctAnswer]?.classList.add('correct');
    }

    quizState.answers.push({
      question: currentQuestion.question,
      options: currentQuestion.options,
      selectedAnswer: optionIndex,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect
    });
    nextButton.style.display = 'inline-flex';
  }

  function showHint() {
    if (quizState.hints <= 0) return;
    const currentQuestion = quizState.questions[quizState.currentQuestion];
    if (!currentQuestion?.hint) return;
    quizState.hints--;
    hintCountElem.textContent = quizState.hints;
    hintContent.textContent = currentQuestion.hint;
    hintContent.style.display = 'block';
  }

  function startTimer() {
    let timeLeft = quizState.timeLimit;
    updateTimerDisplay(timeLeft);
    clearInterval(quizState.timer);
    quizState.timer = setInterval(function() {
      timeLeft--;
      updateTimerDisplay(timeLeft);
      if (timeLeft <= 0) endQuiz();
    }, 1000);
  }

  function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timerElem.textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  async function endQuiz() {
    clearInterval(quizState.timer);
    quizState.endTime = new Date();
    const total = quizState.questions.length;
    const scorePercentage = total ? Math.round((quizState.score / total) * 100) : 0;
    const timeUsed = Math.round((quizState.endTime - quizState.startTime) / 1000);
    const minutes = Math.floor(timeUsed / 60);
    const seconds = timeUsed % 60;

    scorePercentageElem.textContent = `${scorePercentage}%`;
    scoreTextElem.textContent = `您的得分：${quizState.score}/${total}`;
    timeUsedElem.textContent = `用时：${minutes}分${seconds}秒`;
    setBadges(scorePercentage);
    showAnswerReview();
    quizContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    try {
      await api('/quiz/attempts', {
        method: 'POST',
        body: JSON.stringify({
          category: quizState.category,
          difficulty: quizState.difficulty,
          score: quizState.score,
          total,
          timeUsed
        })
      });
    } catch (error) {
      console.warn('测评记录保存失败:', error);
    }
  }

  function setBadges(scorePercentage) {
    badgesContainer.innerHTML = '';
    const badges = [];
    if (scorePercentage >= 90) badges.push({ icon: 'fa-medal', name: '本草精通' });
    else if (scorePercentage >= 70) badges.push({ icon: 'fa-award', name: '熟练掌握' });
    else if (scorePercentage >= 50) badges.push({ icon: 'fa-certificate', name: '基础达标' });
    if (quizState.difficulty === 'hard') badges.push({ icon: 'fa-crown', name: '专业挑战' });

    if (!badges.length) {
      badgesContainer.innerHTML = '<p>暂无徽章，建议回到药材查询页复习后再试。</p>';
      return;
    }

    badges.forEach(badge => {
      const badgeElem = document.createElement('div');
      badgeElem.className = 'badge-item';
      badgeElem.innerHTML = `<div class="badge-icon"><i class="fas ${badge.icon}"></i></div><div class="badge-name">${badge.name}</div>`;
      badgesContainer.appendChild(badgeElem);
    });
  }

  function showAnswerReview() {
    reviewList.innerHTML = '';
    quizState.answers.forEach((answer, index) => {
      const selectedOptionText = answer.options[answer.selectedAnswer] || '未作答';
      const correctOptionText = answer.options[answer.correctAnswer] || '';
      const reviewItem = document.createElement('div');
      reviewItem.className = 'review-item';
      reviewItem.innerHTML = `
        <div class="review-question">${index + 1}. ${escapeHtml(answer.question)}</div>
        <div class="review-answer ${answer.isCorrect ? 'correct' : 'wrong'}">
          <i class="fas ${answer.isCorrect ? 'fa-check' : 'fa-times'}"></i>
          您的答案：${escapeHtml(selectedOptionText)}
          ${!answer.isCorrect ? `<br><span>正确答案：${escapeHtml(correctOptionText)}</span>` : ''}
        </div>`;
      reviewList.appendChild(reviewItem);
    });
  }

  async function loadLeaderboard() {
    try {
      leaderboardTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">请稍候...</td></tr>'; 
      const params = new URLSearchParams();
      if (categoryFilter.value !== 'all') params.set('category', categoryFilter.value);
      if (difficultyFilter.value !== 'all') params.set('difficulty', difficultyFilter.value);
      const rows = await api(`/quiz/leaderboard?${params.toString()}`);
      displayLeaderboard(rows || []);
    } catch (error) {
      leaderboardTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  function displayLeaderboard(rows) {
    leaderboardTableBody.innerHTML = '';
    if (!rows.length) {
      leaderboardTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">暂无真实测评记录</td></tr>';
      return;
    }

    rows.forEach((entry, index) => {
      const scorePercentage = Math.round((entry.score / entry.total) * 100);
      const minutes = Math.floor(entry.time_used / 60);
      const seconds = entry.time_used % 60;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(entry.username || '未登录用户')}</td>
        <td>${escapeHtml(categoryNames[entry.category] || entry.category)}</td>
        <td>${escapeHtml(difficultyNames[entry.difficulty] || entry.difficulty)}</td>
        <td>${entry.score}/${entry.total} (${scorePercentage}%)</td>
        <td>${minutes}分${seconds}秒</td>
        <td>${escapeHtml((entry.created_at || '').slice(0, 10))}</td>`;
      leaderboardTableBody.appendChild(row);
    });
  }

  function resetToSelection() {
    clearInterval(quizState.timer);
    resultsContainer.style.display = 'none';
    leaderboardContainer.style.display = 'none';
    quizContainer.style.display = 'none';
    quizSelection.style.display = 'block';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
});
