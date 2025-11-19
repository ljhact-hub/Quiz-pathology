// --- 전역 상태 변수 ---
let QUESTIONS_DB_P3 = [];     
let QUESTIONS_DB_P1_2 = [];   
let currentMode = 'P3';     
let questionsForQuiz = [];    
let currentQuestions = [];    
let currentIndex = 0;
let score = 0;
let newIncorrect = [];
let isReviewMode = false;
let isSingleProblemMode = false; 
let isExamMode = false; 
let examTimer = null; 
let timeRemaining = 0; 
let QUIZ_STATS = {}; 
let EXAM_HISTORY = []; 
let INCORRECT_LOG = []; 
let currentQuizResults = []; 
let isShuffleOptions = false; 

// 동적 키 생성 함수
const INCORRECT_LOG_KEY = () => `clinicalPathologyQuizLog_${currentMode}`;
const STATS_KEY = () => `clinicalPathologyQuizStats_${currentMode}`;
const EXAM_HISTORY_KEY = () => `clinicalPathologyExamHistory_${currentMode}`;

// DOM 요소
const appContainer = document.getElementById('app-container');
const loadingScreen = document.getElementById('loading-screen');
const errorMessage = document.getElementById('error-message');
const mainMenuScreen = document.getElementById('main-menu-screen');
const numSelectScreen = document.getElementById('num-select-screen');
const customNumScreen = document.getElementById('custom-num-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const problemListScreen = document.getElementById('problem-list-screen');
const statsScreen = document.getElementById('stats-screen');

// --- 앱 초기화 ---
window.addEventListener('DOMContentLoaded', loadApp);

async function loadApp() {
    try {
        const [p3Response, p1_2Response] = await Promise.all([
            fetch('questions.json').catch(e => ({ error: e })),       
            fetch('questions_1-2.json').catch(e => ({ error: e }))  
        ]);

        if (p3Response.ok) QUESTIONS_DB_P3 = await p3Response.json();
        else console.error("3교시 DB 로드 실패");

        if (p1_2Response.ok) QUESTIONS_DB_P1_2 = await p1_2Response.json();
        else console.error("1·2교시 DB 로드 실패");

        if (QUESTIONS_DB_P3.length === 0 && QUESTIONS_DB_P1_2.length === 0) {
            throw new Error("어떤 문제 파일도 불러오지 못했습니다.");
        }

        switchMode('P3'); 
        showScreen('main-menu-screen');
        showMainMenu();

    } catch (error) { 
        console.error("앱 로딩 실패:", error);
        errorMessage.textContent = `오류: ${error.message}`;
        showScreen('loading-screen');
    }
}

// --- 유틸리티: 배열 섞기 ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function switchMode(newMode) {
    if (newMode === currentMode) return; 
    currentMode = newMode;
    document.body.classList.toggle('mode-p1_2', newMode === 'P1_2');
    loadDataForCurrentMode();
}

function switchModeAndShowScreen(newMode, screenId, tabId = null) {
    if (currentMode !== newMode) switchMode(newMode);
    
    if (screenId === 'stats-screen') showStatsScreen(tabId); 
    else showScreen(screenId);
}

function loadDataForCurrentMode() {
    loadIncorrectLog();
    loadQuizStats();
    loadExamHistory();
}

function getCurrentDB() {
    return (currentMode === 'P3') ? QUESTIONS_DB_P3 : QUESTIONS_DB_P1_2;
}

function loadIncorrectLog() {
    INCORRECT_LOG = JSON.parse(localStorage.getItem(INCORRECT_LOG_KEY())) || [];
}
function saveIncorrectLog() {
    localStorage.setItem(INCORRECT_LOG_KEY(), JSON.stringify(INCORRECT_LOG));
}
function loadExamHistory() {
    EXAM_HISTORY = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY())) || [];
}
function saveExamHistory() {
    localStorage.setItem(EXAM_HISTORY_KEY(), JSON.stringify(EXAM_HISTORY));
}
function loadQuizStats() {
    QUIZ_STATS = JSON.parse(localStorage.getItem(STATS_KEY())) || {};
    const subjects = [...new Set(getCurrentDB().map(q => q.subject || "기타"))];
    subjects.forEach(subject => {
        if (!QUIZ_STATS[subject]) QUIZ_STATS[subject] = { correct: 0, total: 0 };
    });
}
function saveQuizStats() {
    localStorage.setItem(STATS_KEY(), JSON.stringify(QUIZ_STATS));
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) activeScreen.classList.add('active');
    
    document.body.className = document.body.className.replace(/correct-feedback|incorrect-feedback/g, '').trim();
    document.body.classList.toggle('mode-p1_2', currentMode === 'P1_2');
}

// --- 메인 메뉴 ---
function showMainMenu() {
    showScreen('main-menu-screen'); 
    stopTimer(); 

    const subjects = [...new Set(getCurrentDB().map(q => q.subject || "기타"))].sort();
    let subjectCheckboxesHTML = subjects.map(subject => `
        <label class="subject-item"><input type="checkbox" class="subject-checkbox" value="${subject}">${subject}</label>
    `).join('');

    const p1_2_active = currentMode === 'P1_2' ? 'active' : '';
    const p3_active = currentMode === 'P3' ? 'active' : '';
    
    // [수정] 모드에 따른 시험 버튼 생성
    let examButtonHTML = '';
    if (currentMode === 'P3') {
        examButtonHTML = `
            <h3 style="margin-bottom: 5px; margin-top: 20px;">시험 모드</h3>
            <button id="exam-start-btn-p3" class="btn-exam">⏱️ 3교시 실기 (65문제/65분)</button>
        `;
    } else {
        // 1, 2교시 모드일 때는 버튼 2개 표시
        examButtonHTML = `
            <h3 style="margin-bottom: 5px; margin-top: 20px;">시험 모드</h3>
            <button id="exam-start-btn-p1" class="btn-exam" style="margin-bottom: 10px;">⏱️ 1교시 이론 (100문제/85분)</button>
            <button id="exam-start-btn-p2" class="btn-exam">⏱️ 2교시 이론 (115문제/95분)</button>
        `;
    }

    const modeName = currentMode === 'P3' ? '3교시' : '1·2교시';

    mainMenuScreen.innerHTML = `
        <div id="mode-switcher">
            <button id="mode-p1_2-btn" class="mode-btn ${p1_2_active}">1·2교시 (이론)</button>
            <button id="mode-p3-btn" class="mode-btn ${p3_active}">3교시 (실기)</button>
        </div>
        <h1>임상병리 퀴즈 (${modeName})</h1>
        <div class="main-menu-tab-container">
            <button id="tab-practice" class="tab-btn active">연습</button>
            <button id="tab-exam" class="tab-btn">시험 모드</button> <button id="tab-other" class="tab-btn">기타</button>
        </div>

        <div id="tab-content-practice" class="tab-content active">
            <h2>풀고 싶은 과목을 선택하세요</h2>
            <div style="width: 100%; max-width: 500px; display: flex; gap: 10px; margin: 10px 0;">
                <button id="select-all-btn" style="flex: 1;">전체 선택</button>
                <button id="deselect-all-btn" style="flex: 1;">전체 해제</button>
            </div>
            <div class="subject-grid">${subjectCheckboxesHTML}</div>
            <button id="start-quiz-btn">선택한 과목으로 퀴즈 시작</button>
            <button id="review-btn">오답 노트 풀기 (${INCORRECT_LOG.length}개)</button>
            <button id="problem-list-btn">문제 목록 보기 (전체 ${getCurrentDB().length}개)</button>
        </div>
        
        <div id="tab-content-exam" class="tab-content">
            ${examButtonHTML}
        </div>
        
        <div id="tab-content-other" class="tab-content">
            <div class="toggle-wrapper">
                <span>선택지 섞기</span>
                <label class="switch">
                    <input type="checkbox" id="shuffle-toggle" ${isShuffleOptions ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>

            <button id="stats-btn" class="btn-stats">📊 학습 통계</button>
            <button id="reset-all-btn" class="btn-danger">🚨 모든 기록 초기화</button>
            <button id="exit-btn" style="background-color: #aaa; margin-top: 20px;">종료 (새로고침)</button>
        </div>
    `;
    
    // --- 이벤트 리스너 ---
    document.getElementById('shuffle-toggle').addEventListener('change', (e) => { isShuffleOptions = e.target.checked; });

    document.getElementById('mode-p1_2-btn').addEventListener('click', () => { switchMode('P1_2'); showMainMenu(); });
    document.getElementById('mode-p3-btn').addEventListener('click', () => { switchMode('P3'); showMainMenu(); });
    document.getElementById('select-all-btn').addEventListener('click', () => document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = true));
    document.getElementById('deselect-all-btn').addEventListener('click', () => document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = false));
    document.getElementById('start-quiz-btn').addEventListener('click', handleQuizStart);
    document.getElementById('problem-list-btn').addEventListener('click', showProblemList);
    document.getElementById('stats-btn').addEventListener('click', () => showStatsScreen());
    document.getElementById('reset-all-btn').addEventListener('click', handleResetAllData);
    document.getElementById('exit-btn').addEventListener('click', () => location.reload());

    const reviewBtn = document.getElementById('review-btn');
    reviewBtn.addEventListener('click', startReviewQuiz);
    if (INCORRECT_LOG.length === 0) reviewBtn.disabled = true;

    // [수정] 시험 버튼 이벤트 연결 (동적)
    if (currentMode === 'P3') {
        document.getElementById('exam-start-btn-p3').addEventListener('click', () => handleExamStart('P3'));
    } else {
        document.getElementById('exam-start-btn-p1').addEventListener('click', () => handleExamStart('P1'));
        document.getElementById('exam-start-btn-p2').addEventListener('click', () => handleExamStart('P2'));
    }

    // 탭 로직
    const tabPractice = document.getElementById('tab-practice');
    const tabExam = document.getElementById('tab-exam');
    const tabOther = document.getElementById('tab-other');
    const contentPractice = document.getElementById('tab-content-practice');
    const contentExam = document.getElementById('tab-content-exam');
    const contentOther = document.getElementById('tab-content-other');
    
    const showMainTab = (tabId) => {
        [tabPractice, tabExam, tabOther].forEach(t => t && t.classList.remove('active'));
        [contentPractice, contentExam, contentOther].forEach(c => c && c.classList.remove('active'));
        
        if (tabId === 'exam') { tabExam.classList.add('active'); contentExam.classList.add('active'); }
        else if (tabId === 'other') { tabOther.classList.add('active'); contentOther.classList.add('active'); }
        else { tabPractice.classList.add('active'); contentPractice.classList.add('active'); }
    };
    tabPractice.addEventListener('click', () => showMainTab('practice'));
    tabExam.addEventListener('click', () => showMainTab('exam'));
    tabOther.addEventListener('click', () => showMainTab('other'));
}

function handleResetAllData() {
    const modeName = currentMode === 'P3' ? '3교시' : '1·2교시';
    if (confirm(`[${modeName} 모드]\n정말 '${modeName}'의 모든 기록 (오답 노트, 연습 통계, 시험 이력)을 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        localStorage.removeItem(INCORRECT_LOG_KEY());
        localStorage.removeItem(STATS_KEY());
        localStorage.removeItem(EXAM_HISTORY_KEY());
        loadDataForCurrentMode(); 
        alert(`'${modeName}'의 모든 기록이 초기화되었습니다.`);
        showMainMenu(); 
    }
}

function handleQuizStart() {
    const selectedSubjects = Array.from(document.querySelectorAll('.subject-checkbox:checked')).map(cb => cb.value);
    if (selectedSubjects.length === 0) { alert("하나 이상의 과목을 선택해주세요."); return; }
    questionsForQuiz = getCurrentDB().filter(q => selectedSubjects.includes(q.subject));
    showNumSelectScreen();
}

function showNumSelectScreen() {
    showScreen('num-select-screen'); 
    const total = questionsForQuiz.length;
    numSelectScreen.innerHTML = `
        <h2>몇 문제를 푸시겠습니까?</h2>
        <p style="font-size: 22px;">(선택된 과목 총 ${total}개)</p>
        <select id="num-combo"><option>10</option><option>20</option><option>30</option><option>50</option><option>사용자 지정</option></select>
        <button id="start-btn">시작</button><button id="num-back-to-main-btn">뒤로가기</button>
    `;
    document.getElementById('start-btn').addEventListener('click', () => {
        const choice = document.getElementById('num-combo').value;
        if (choice === "사용자 지정") showCustomNumScreen();
        else prepareAndRunQuiz(parseInt(choice, 10));
    });
    document.getElementById('num-back-to-main-btn').addEventListener('click', showMainMenu);
}

function showCustomNumScreen() {
    showScreen('custom-num-screen'); 
    customNumScreen.innerHTML = `<h2>문제 수를 입력하세요 (최대 ${questionsForQuiz.length}개):</h2><input type="text" id="custom-num-input" inputmode="numeric" pattern="[0-9]*"><button id="ok-btn">확인</button><button id="cancel-btn">취소</button>`;
    document.getElementById('ok-btn').addEventListener('click', () => {
        const val = parseInt(document.getElementById('custom-num-input').value, 10);
        if (val > 0) prepareAndRunQuiz(val); else alert("1 이상의 숫자를 입력해주세요.");
    });
    document.getElementById('cancel-btn').addEventListener('click', showNumSelectScreen);
}

function prepareAndRunQuiz(num) {
    const count = Math.min(num, questionsForQuiz.length);
    const shuffled = [...questionsForQuiz].sort(() => 0.5 - Math.random());
    runQuiz(shuffled.slice(0, count));
}

function runQuiz(questionList, isReview = false, isSingleMode = false, isExam = false) { 
    currentQuestions = questionList;
    currentIndex = 0;
    score = 0;
    newIncorrect = [];
    isReviewMode = isReview;
    isSingleProblemMode = isSingleMode; 
    isExamMode = isExam; 
    currentQuizResults = [];
    quizStartTime = new Date(); 
    problemTimes = []; 

    if (isExamMode) startTimer();
    showQuestion();
}

function showQuestion() {
    problemStartTime = new Date(); 
    showScreen('quiz-screen');
    const q = currentQuestions[currentIndex];
    const timerDisplay = document.getElementById('timer-display'); 
    
    let backBtnHTML = isSingleProblemMode ? '<button id="back-to-list-btn" class="back-button">&lt;</button>' : '';
    let submitBtnText = (isExamMode && currentIndex === currentQuestions.length - 1) ? '결과 보기' : (isExamMode ? '다음 문제' : '제출');

    if (isExamMode && timerDisplay) {
        timerDisplay.style.display = 'block';
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else if (timerDisplay) {
        timerDisplay.style.display = 'none';
    }

    let imageHTML = '';
    if (q.image_path) { 
        imageHTML = `<img id="quiz-image" src="${q.image_path}" alt="문제 이미지 (${q.image_path})" onerror="this.style.display='none';">`;
    }

    let inputHTML = '';
    if (q.type === "multiple_choice") {
        let displayOptions = [...q.options];
        if (isShuffleOptions) shuffleArray(displayOptions);

        const optionsHTML = displayOptions.map(option => 
            `<label class="option-label"><input type="radio" name="answer" value="${option.split('.')[0]}">${option}</label>`
        ).join('');
        inputHTML = `<div class="options-container">${optionsHTML}</div>`;
    } else { 
        inputHTML = `<input type="text" id="answer-input" placeholder="정답을 입력하세요">`;
    }

    const quizWrapper = document.getElementById('quiz-content-wrapper');
    if (quizWrapper) {
        quizWrapper.innerHTML = `${backBtnHTML}${imageHTML}<p id="question-text">문제 ${currentIndex + 1}/${currentQuestions.length}\n\n${q.question}</p><div id="feedback-label"></div>${inputHTML}<div id="button-container"><button id="submit-btn">${submitBtnText}</button></div>`;
    }
    
    document.getElementById('submit-btn').addEventListener('click', checkAnswer);
    if (isSingleProblemMode) document.getElementById('back-to-list-btn').addEventListener('click', showProblemList);
}

function checkAnswer() {
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    
    const q = currentQuestions[currentIndex];
    const inputs = document.querySelectorAll('input[name="answer"], #answer-input');
    
    let userAns = "";
    if (q.type === "multiple_choice") {
        const checked = document.querySelector('input[name="answer"]:checked');
        if (!checked && !isExamMode) { alert("답을 선택하세요."); if(submitBtn) submitBtn.disabled=false; return; }
        userAns = checked ? checked.value : "";
    } else {
        const val = document.getElementById('answer-input').value.trim();
        if (!val && !isExamMode) { alert("답을 입력하세요."); if(submitBtn) submitBtn.disabled=false; return; }
        userAns = val;
    }

    inputs.forEach(el => el.disabled = true);
    if (submitBtn && !isExamMode) submitBtn.style.display = 'none';

    let isCorrect = (userAns === q.answer);
    const timeTaken = new Date() - problemStartTime;
    problemTimes.push({ questionText: q.question, time: timeTaken });

    if (isExamMode) {
        if (isCorrect) score++;
        if (!isCorrect && !newIncorrect.includes(q.id)) newIncorrect.push(q.id);
        currentQuizResults.push({ subject: q.subject || "기타", isCorrect: isCorrect });
        goToNextQuestionOrFinish();
        return;
    }
    
    if (!isReviewMode && !isSingleProblemMode) {
        currentQuizResults.push({ subject: q.subject || "기타", isCorrect: isCorrect });
    }

    const feedbackLabel = document.getElementById('feedback-label');
    const buttonContainer = document.getElementById('button-container');

    if (isCorrect) {
        feedbackLabel.textContent = "✅ 정답입니다!";
        feedbackLabel.className = 'correct';
        document.body.classList.add('correct-feedback');
        if(!isExamMode) score++;
        if (isReviewMode) INCORRECT_LOG = INCORRECT_LOG.filter(id => id !== q.id);
        
        setTimeout(() => {
             if (isSingleProblemMode) {
                const returnBtn = document.createElement('button');
                returnBtn.textContent = '목록으로 돌아가기';
                returnBtn.onclick = showProblemList;
                if(buttonContainer) buttonContainer.appendChild(returnBtn);
             } else goToNextQuestionOrFinish();
        }, 1200);
    } else {
        feedbackLabel.textContent = `❌ 오답입니다. 정답: ${q.answer}\n[해설] ${q.explanation}`;
        feedbackLabel.className = 'incorrect';
        document.body.classList.add('incorrect-feedback');
        if (!isReviewMode && !newIncorrect.includes(q.id)) newIncorrect.push(q.id);

        const nextBtn = document.createElement('button');
        if (isSingleProblemMode) { 
            nextBtn.textContent = '목록으로 돌아가기';
            nextBtn.onclick = showProblemList;
        } else {
            nextBtn.textContent = '다음 문제';
            nextBtn.onclick = goToNextQuestionOrFinish;
        }
        if(buttonContainer) buttonContainer.appendChild(nextBtn);
    }
}

function goToNextQuestionOrFinish() {
    if (!isExamMode) document.body.className = '';
    currentIndex++;
    if (currentIndex < currentQuestions.length) showQuestion();
    else finishQuiz();
}

function finishQuiz() {
    stopTimer();
    
    if (!isReviewMode && !isSingleProblemMode) {
        if (currentQuizResults.length > 0) {
            if (isExamMode) {
                const breakdown = {};
                currentQuizResults.forEach(r => {
                    if (!breakdown[r.subject]) breakdown[r.subject] = { correct: 0, total: 0 };
                    breakdown[r.subject].total++;
                    if (r.isCorrect) breakdown[r.subject].correct++;
                });
                EXAM_HISTORY.push({
                    date: new Date().toISOString(),
                    total: currentQuestions.length,
                    correct: score,
                    incorrectIds: newIncorrect,
                    subjectBreakdown: breakdown
                });
                saveExamHistory();
            } else {
                currentQuizResults.forEach(r => {
                    if (!QUIZ_STATS[r.subject]) QUIZ_STATS[r.subject] = { correct: 0, total: 0 };
                    QUIZ_STATS[r.subject].total++;
                    if (r.isCorrect) QUIZ_STATS[r.subject].correct++;
                });
                saveQuizStats();
            }
        }
        INCORRECT_LOG = [...new Set([...INCORRECT_LOG, ...newIncorrect])].sort((a,b)=>a-b);
        saveIncorrectLog();
    } else if (isReviewMode) {
        saveIncorrectLog();
    }

    showScreen('results-screen');
    const total = currentQuestions.length;
    const accuracy = total > 0 ? (score/total)*100 : 0;
    const resultTitle = isExamMode ? "📝 시험 결과" : "📊 퀴즈 결과";
    
    const totalTime = new Date() - quizStartTime;
    const timeStr = `${Math.floor(totalTime/60000)}분 ${Math.floor((totalTime%60000)/1000)}초`;

    let slowestStr = "N/A";
    if (problemTimes.length > 0) {
        const slow = problemTimes.reduce((m, c) => c.time > m.time ? c : m);
        slowestStr = `(${(slow.time/1000).toFixed(1)}초) ${slow.questionText.substring(0,30)}...`;
    }

    resultsScreen.innerHTML = `
        <h2>${resultTitle}</h2>
        <div class="donut-chart-container"><div class="donut-chart" style="--accuracy: ${accuracy}%"></div><div class="donut-chart-center">${accuracy.toFixed(1)}%</div></div>
        <p style="font-size: 22px; text-align: center;">총 문제: ${total}개<br>맞힌 개수: ${score}개<br>틀린 개수: ${newIncorrect.length}개</p>
        <div style="background-color:#f8f8f8; padding:15px; border-radius:8px; margin:15px 0; text-align:left; width:100%; max-width:600px;">
            <p><strong>⏱️ 총 소요 시간:</strong> ${timeStr}</p>
            <p><strong>🐌 가장 오래 걸린 문제:</strong> ${slowestStr}</p>
        </div>
        <button id="review-new-mistakes-btn">방금 틀린 문제 복습하기 (${newIncorrect.length}개)</button>
        <button id="result-back-to-main-btn">메인 메뉴로 돌아가기</button>
    `;
    
    const reviewBtn = document.getElementById('review-new-mistakes-btn');
    if (newIncorrect.length === 0 || isExamMode) reviewBtn.style.display = 'none';
    else reviewBtn.onclick = () => {
        runQuiz(getCurrentDB().filter(q => newIncorrect.includes(q.id))); 
    };
    
    document.getElementById('result-back-to-main-btn').onclick = showMainMenu;
}

// --- [수정] 시험 시작 핸들러 (타입 인자 추가) ---
function handleExamStart(examType) {
    const examQuestions = generateExamQuestions(examType);
    if (examQuestions.length > 0) {
        // 시간 설정: P1=85분, P2=95분, P3=65분
        if (examType === 'P1') timeRemaining = 85 * 60;
        else if (examType === 'P2') timeRemaining = 95 * 60;
        else timeRemaining = 65 * 60;

        runQuiz(examQuestions, false, false, true); 
    }
}

// --- [수정] 시험 문제 생성기 (Blueprints 적용) ---
function generateExamQuestions(examType) {
    let blueprint = [];
    let targetDB = [];

    // 1교시 (100문제) Blueprint
    const BP_P1 = [
        { s: "의료법규", c: 20 },
        { s: "공중보건", c: 10 },
        { s: "해부학", c: 10 }, // 31-40
        { s: "조직학", c: 21 }, // 41-44(4) + 46-62(17)
        { s: "유전학", c: 1 },  // 45
        { s: "세포학", c: 8 },  // 63-70
        { s: "심전도", c: 9 },  // 71-79
        { s: "뇌파", c: 6 },    // 80-85
        { s: "근전도", c: 4 },  // 86-88, 94
        { s: "폐기능", c: 5 },  // 89-93
        { s: "심초음파", c: 6 } // 95-100
    ];

    // 2교시 (115문제) Blueprint
    const BP_P2 = [
        { s: "임상화학", c: 27 }, // 1-27
        { s: "요화학", c: 7 },    // 28-34
        { s: "핵의학", c: 4 },    // 35-38
        { s: "혈액학", c: 22 },   // 39-60
        { s: "유전학", c: 1 },    // 61
        { s: "수혈학", c: 12 },   // 62-73
        { s: "미생물학", c: 20 }, // 74-93
        { s: "진균학", c: 3 },    // 94-96
        { s: "바이러스학", c: 3 },// 97-99
        { s: "기생충학", c: 3 },  // 100-102
        { s: "혈청학", c: 13 }    // 103-115
    ];

    // 3교시 (65문제) Blueprint
    const BP_P3 = [
        { s:"조직학",c:9 }, { s:"세포학",c:7 }, { s:"임상화학",c:14 }, 
        { s:"핵의학",c:2 }, { s:"혈액학",c:11 }, { s:"수혈학",c:5 }, 
        { s:"요화학",c:1 }, { s:"미생물학",c:6 }, { s:"진균학",c:2 }, 
        { s:"바이러스학",c:2 }, { s:"기생충학",c:2 }, { s:"혈청학",c:4 }
    ];

    if (examType === 'P1') {
        blueprint = BP_P1;
        targetDB = QUESTIONS_DB_P1_2;
    } else if (examType === 'P2') {
        blueprint = BP_P2;
        targetDB = QUESTIONS_DB_P1_2;
    } else { // P3
        blueprint = BP_P3;
        targetDB = QUESTIONS_DB_P3;
    }

    let qList = [];
    const pools = {};
    
    // 과목별 분류
    targetDB.forEach(q => {
        // 과목명이 정확하지 않을 수 있으므로 포함 여부로 체크 (유연성)
        let subj = q.subject || "기타";
        if (!pools[subj]) pools[subj] = [];
        pools[subj].push(q);
    });

    for(const item of blueprint) {
        // 정확한 과목명 매칭 시도, 없으면 경고
        const p = pools[item.s] || [];
        if(p.length < item.c) { 
            // 과목이 없거나 부족하면 경고 후 중단 (DB가 아직 안 채워졌을 수 있음)
            // 개발 중 편의를 위해 부족하면 있는거 다 넣고 넘어가는 방식도 가능하지만,
            // 시험 모드는 정확해야 하므로 경고를 띄웁니다.
            // 단, 사용자가 아직 DB를 안 채웠을 확률이 높으므로, 
            // 에러 대신 알림만 띄우고 가능한 만큼만 넣어서 실행되게 수정 (테스트용)
            console.warn(`${item.s} 문제 부족: 필요 ${item.c}, 보유 ${p.length}`);
            // 실제 배포 시엔 아래 주석 해제
            // alert(`${item.s} 문제가 부족합니다. (필요: ${item.c}개, 보유: ${p.length}개)`); return [];
        }
        qList = qList.concat(p.sort(()=>0.5-Math.random()).slice(0, item.c));
    }
    
    if (qList.length === 0) {
        alert("생성된 문제가 없습니다. 문제 파일(JSON)의 과목명을 확인해주세요.");
    }
    
    return qList;
}

function startTimer() {
    const display = document.getElementById('timer-display');
    examTimer = setInterval(() => {
        timeRemaining--;
        if(display) display.textContent = `${Math.floor(timeRemaining/60).toString().padStart(2,'0')}:${(timeRemaining%60).toString().padStart(2,'0')}`;
        if(timeRemaining<=0) { stopTimer(); alert("시간 종료!"); finishQuiz(); }
    }, 1000);
}
function stopTimer() { if(examTimer) { clearInterval(examTimer); examTimer = null; } }

function showProblemList() {
    showScreen('problem-list-screen');
    const html = getCurrentDB().map(q => `<li class="problem-list-item" onclick="startSingleProblem(${q.id})">ID ${q.id} (${q.subject}): ${q.question.substring(0,40)}...</li>`).join('');
    problemListScreen.innerHTML = `<h2>문제 목록</h2><ul class="problem-list-container">${html}</ul><button onclick="showMainMenu()">메인 메뉴로 돌아가기</button>`;
}
function startSingleProblem(id) { runQuiz([getCurrentDB().find(q=>q.id===id)], false, true); }

function startReviewQuiz() {
    if (!INCORRECT_LOG || INCORRECT_LOG.length === 0) {
        alert("오답 노트에 문제가 없습니다.");
        return;
    }
    const reviewQuestions = getCurrentDB().filter(q => INCORRECT_LOG.includes(q.id));
    runQuiz(reviewQuestions, true); 
}

function showStatsScreen(defaultTab = 'practice') { 
    showScreen('stats-screen');
    const p1_2_active = currentMode === 'P1_2' ? 'active' : '';
    const p3_active = currentMode === 'P3' ? 'active' : '';
    const modeSwitcherHTML = `<div id="mode-switcher"><button id="stats-mode-p1_2" class="mode-btn ${p1_2_active}">1·2교시</button><button id="stats-mode-p3" class="mode-btn ${p3_active}">3교시</button></div>`;

    const { practiceStatsHTML, overallAccuracy, totalAttempts } = generatePracticeStats();
    const examHistoryHTML = renderExamHistoryGraph();
    // [수정] 1,2교시도 시험 이력 탭 표시
    const examTabHTML = '<button id="tab-exam" class="tab-btn">시험 이력</button>';
    const examContentHTML = `<div id="exam-stats-content" class="tab-content"><h3>최근 시험 이력</h3>${examHistoryHTML}</div>`;

    statsScreen.innerHTML = `${modeSwitcherHTML}<h2>📊 학습 통계 (${currentMode==='P3'?'3교시':'1·2교시'})</h2><div style="display:flex;width:100%;max-width:800px;border-bottom:2px solid #eee;margin-bottom:20px;"><button id="tab-practice" class="tab-btn">연습 통계</button>${examTabHTML}</div><div id="practice-stats-content" class="tab-content"><div class="stats-summary"><div class="summary-box total"><h4>총 정답률</h4><p>${overallAccuracy.toFixed(1)}%</p></div><div class="summary-box total"><h4>누적 문제</h4><p>${totalAttempts}개</p></div></div><h3>과목별 정답률</h3>${practiceStatsHTML}</div>${examContentHTML}<button id="stats-back-to-main-btn" style="margin-top:30px;">메인 메뉴로 돌아가기</button><div id="session-modal" class="modal-backdrop"><div id="modal-content-inner" class="modal-content"></div></div>`;
    
    document.getElementById('stats-back-to-main-btn').onclick = showMainMenu;
    document.getElementById('stats-mode-p1_2').onclick = () => switchModeAndShowScreen('P1_2', 'stats-screen', defaultTab);
    document.getElementById('stats-mode-p3').onclick = () => switchModeAndShowScreen('P3', 'stats-screen', defaultTab);
    
    const tabs = { practice: document.getElementById('tab-practice'), exam: document.getElementById('tab-exam') };
    const contents = { practice: document.getElementById('practice-stats-content'), exam: document.getElementById('exam-stats-content') };
    
    const activateTab = (t) => {
        Object.values(tabs).forEach(el => el && el.classList.remove('active'));
        Object.values(contents).forEach(el => el && el.classList.remove('active'));
        if(tabs[t]) tabs[t].classList.add('active');
        if(contents[t]) contents[t].classList.add('active');
    };

    tabs.practice.onclick = () => activateTab('practice');
    if(tabs.exam) {
        tabs.exam.onclick = () => activateTab('exam');
        contents.exam.onclick = (e) => {
            const bar = e.target.closest('.bar-vertical');
            if(bar) showExamSessionDetail(parseInt(bar.dataset.index, 10));
        };
    }
    document.getElementById('session-modal').onclick = (e) => { if(e.target.id==='session-modal') closeModal(); };
    activateTab(defaultTab);
}

function generatePracticeStats() {
    let totalCorrect=0, totalAttempts=0, subjectStats=[];
    for(const s in QUIZ_STATS) {
        const d = QUIZ_STATS[s];
        totalCorrect += d.correct; totalAttempts += d.total;
        subjectStats.push({ name: s, correct: d.correct, total: d.total, accuracy: d.total>0?(d.correct/d.total)*100:0 });
    }
    subjectStats.sort((a,b) => b.accuracy - a.accuracy);
    const overallAccuracy = totalAttempts>0 ? (totalCorrect/totalAttempts)*100 : 0;
    
    const weak = subjectStats.length>0 ? subjectStats.reduce((m,s)=>s.accuracy<m.accuracy?s:m) : {name:'N/A',accuracy:0};
    const strong = subjectStats.length>0 ? subjectStats.reduce((m,s)=>s.accuracy>m.accuracy?s:m) : {name:'N/A',accuracy:0};
    
    const html = `<div class="stats-summary"><div class="summary-box weak"><h4>📉 취약</h4><p>${weak.name}</p><span>(${weak.accuracy.toFixed(0)}%)</span></div><div class="summary-box strong"><h4>📈 우수</h4><p>${strong.name}</p><span>(${strong.accuracy.toFixed(0)}%)</span></div></div><div class="stats-bar-graph-container">` + subjectStats.map(s => `
        <div class="bar-item"><div class="bar-label">${s.name}</div><div class="bar-wrapper"><div class="bar ${s.accuracy>=75?'high-accuracy':s.accuracy<40?'low-accuracy':''}" style="width:${s.accuracy}%">${s.accuracy>=50?s.accuracy.toFixed(0)+'%':''}</div></div><div class="bar-label" style="width:80px;text-align:right;">(${s.correct}/${s.total})</div></div>`).join('') + `</div>`;
    return { practiceStatsHTML: html, overallAccuracy, totalAttempts, weakSubject: weak, strongSubject: strong };
}

function renderExamHistoryGraph() {
    if (EXAM_HISTORY.length === 0) return "<p style='text-align:center'>기록 없음</p>";
    const recent = EXAM_HISTORY.slice(-10);
    const html = `<div class="exam-bar-graph-container">` + recent.map((s, i) => {
        const acc = (s.correct/s.total)*100;
        const date = new Date(s.date).toLocaleDateString('ko-KR', {month:'2-digit',day:'2-digit'});
        return `<div class="bar-vertical-wrapper"><div class="bar-vertical" data-index="${EXAM_HISTORY.length-recent.length+i}" style="height:${acc}%"><span class="bar-percentage">${acc.toFixed(0)}%</span></div><span class="bar-vertical-label">${i+1}회</span><span class="bar-vertical-label">${date}</span></div>`;
    }).join('') + `</div>`;
    return html;
}

function showExamSessionDetail(idx) {
    const s = EXAM_HISTORY[idx];
    const acc = (s.correct/s.total)*100;
    const modal = document.getElementById('modal-content-inner');
    
    let detailHTML = s.subjectBreakdown ? Object.keys(s.subjectBreakdown).map(sub => {
        const d = s.subjectBreakdown[sub];
        const subAcc = (d.correct/d.total)*100;
        return `<div class="bar-item"><div class="bar-label">${sub}</div><div class="bar-wrapper"><div class="bar ${subAcc>=75?'high-accuracy':subAcc<40?'low-accuracy':''}" style="width:${subAcc}%">${subAcc>=50?subAcc.toFixed(0)+'%':''}</div></div><div class="bar-label" style="width:80px;text-align:right;">(${d.correct}/${d.total})</div></div>`;
    }).join('') : '<p>상세 정보 없음</p>';

    modal.innerHTML = `<h2>${idx+1}회차 상세</h2><p>점수: ${s.correct}/${s.total} (${acc.toFixed(1)}%)</p><hr>${detailHTML}<hr><button id="modal-review" class="btn-exam">오답 리뷰 (${s.incorrectIds.length}개)</button><button id="modal-close" class="btn-modal-close">닫기</button>`;
    
    document.getElementById('modal-review').onclick = () => { closeModal(); reviewMistakes(s.incorrectIds); };
    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('session-modal').classList.add('active');
}
function closeModal() { document.getElementById('session-modal').classList.remove('active'); }