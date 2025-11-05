// --- 전역 상태 변수 ---
let QUESTIONS_DB = [];
let INCORRECT_LOG = [];
let questionsForQuiz = [];  
let currentQuestions = [];  
let currentIndex = 0;
let score = 0;
let newIncorrect = [];
let isReviewMode = false;
let isSingleProblemMode = false; 

// ▼▼▼ 시험 모드 변수 추가 ▼▼▼
let isExamMode = false; 
let examTimer = null; 
let timeRemaining = 0; 
// ▲▲▲ 시험 모드 변수 추가 ▲▲▲

// ▼▼▼ 시험 이력 변수 추가 ▼▼▼
let EXAM_HISTORY = []; 
const EXAM_HISTORY_KEY = "clinicalPathologyExamHistory";
// ▲▲▲ 시험 이력 변수 추가 ▲▲▲

let QUIZ_STATS = {}; 
let currentQuizResults = []; 

const INCORRECT_LOG_KEY = "clinicalPathologyQuizLog";
const STATS_KEY = "clinicalPathologyQuizStats"; 

// --- DOM 요소 참조 ---
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
        await loadQuestionsFromJson();
        loadIncorrectLog();
        loadQuizStats(); 
        loadExamHistory(); // ▼▼▼ 시험 이력 로드 ▼▼▼
        if (QUESTIONS_DB.length === 0) {
            throw new Error("questions.json 파일이 비어있습니다.");
        }
        showScreen('main-menu-screen');
        showMainMenu();
    } catch (error) {
        console.error("앱 로딩 실패:", error);
        errorMessage.textContent = `오류: ${error.message}. 'questions.json' 파일이 올바른 위치에 있는지 확인하세요.`;
        showScreen('loading-screen');
    }
}

// --- 화면 전환 헬퍼 ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
    } else {
        console.error("Screen not found:", screenId);
    }
    document.body.className = '';
}

// --- 데이터 로드 ---
async function loadQuestionsFromJson() {
    const response = await fetch('questions.json');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    QUESTIONS_DB = await response.json();
}

function loadIncorrectLog() {
    INCORRECT_LOG = JSON.parse(localStorage.getItem(INCORRECT_LOG_KEY)) || [];
}

// ▼▼▼ 시험 이력 저장/로드 함수 추가 ▼▼▼
function loadExamHistory() {
    EXAM_HISTORY = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY)) || [];
}

function saveExamHistory() {
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(EXAM_HISTORY));
}
// ▲▲▲ 시험 이력 저장/로드 함수 추가 ▲▲▲

function loadQuizStats() {
    QUIZ_STATS = JSON.parse(localStorage.getItem(STATS_KEY)) || {};
    let statsUpdated = false;
    const subjects = [...new Set(QUESTIONS_DB.map(q => q.subject || "기타"))];
    subjects.forEach(subject => {
        if (!QUIZ_STATS[subject]) {
            QUIZ_STATS[subject] = { correct: 0, total: 0 };
            statsUpdated = true;
        }
    });
    if (statsUpdated) {
        saveQuizStats(); 
    }
}

function saveQuizStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(QUIZ_STATS));
}

function saveIncorrectLog() {
    localStorage.setItem(INCORRECT_LOG_KEY, JSON.stringify(INCORRECT_LOG));
}

// --- (신규) 시험 모드 시작 핸들러 ---
function handleExamStart() {
    const examQuestions = generateExamQuestions();
    
    if (examQuestions.length > 0) {
        timeRemaining = 65 * 60; // 65분 = 3900초
        runQuiz(examQuestions, false, false, true); // isExamMode = true
    }
}

// --- (신규) 시험 문제 생성기 (요청하신 비율 기반) ---
function generateExamQuestions() {
    const EXAM_BLUEPRINT = [
        { subject: "조직학", count: 9 },
        { subject: "세포학", count: 7 },
        { subject: "임상화학", count: 14 },
        { subject: "핵의학", count: 2 },
        { subject: "혈액학", count: 11 },
        { subject: "수혈학", count: 5 },
        { subject: "요화학", count: 1 },
        { subject: "미생물학", count: 6 },
        { subject: "진균학", count: 2 },
        { subject: "바이러스학", count: 2 },
        { subject: "기생충학", count: 2 },
        { subject: "혈청학", count: 4 }
    ];

    let examQuestions = [];
    
    const subjectPools = {};
    QUESTIONS_DB.forEach(q => {
        const subject = q.subject || "기타";
        if (!subjectPools[subject]) {
            subjectPools[subject] = [];
        }
        subjectPools[subject].push(q);
    });

    for (const item of EXAM_BLUEPRINT) {
        const pool = subjectPools[item.subject] || [];
        
        if (pool.length < item.count) {
            alert(`시험 문제 생성 실패!\n'${item.subject}' 과목의 문제가 ${item.count}개 필요한데, DB에 ${pool.length}개밖에 없습니다.`);
            return []; 
        }
        
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const sampled = shuffled.slice(0, item.count);
        examQuestions = examQuestions.concat(sampled);
    }
    
    if (examQuestions.length !== 65) {
        alert(`오류: 총 ${examQuestions.length}개의 문제가 생성되었습니다. 65개가 아닙니다.`);
        return [];
    }

    return examQuestions;
}

// --- (신규) 타이머 시작 ---
function startTimer() {
    const timerDisplay = document.getElementById('timer-display');
    
    examTimer = setInterval(() => {
        timeRemaining--; 
        
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        timerDisplay.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (timeRemaining <= 0) {
            stopTimer();
            alert("시험 시간이 종료되었습니다!");
            finishQuiz(); 
        }
    }, 1000); 
}

// --- (신규) 타이머 정지 ---
function stopTimer() {
    if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }
}

// --- 1. 메인 메뉴 (PyQt: show_subject_selection_menu) ---
function showMainMenu() {
    showScreen('main-menu-screen'); 
    stopTimer(); 

    const subjects = [...new Set(QUESTIONS_DB.map(q => q.subject || "기타"))].sort();
    
    let subjectCheckboxesHTML = subjects.map(subject => `
        <label class="subject-item">
            <input type="checkbox" class="subject-checkbox" value="${subject}">
            ${subject}
        </label>
    `).join('');

    mainMenuScreen.innerHTML = `
        <h1>풀고 싶은 과목을 모두 선택하세요</h1>
        <div style="width: 100%; max-width: 500px; display: flex; gap: 10px; margin: 10px 0;">
            <button id="select-all-btn" style="flex: 1;">전체 선택</button>
            <button id="deselect-all-btn" style="flex: 1;">전체 해제</button>
        </div>
        <div class="subject-grid">${subjectCheckboxesHTML}</div>

        <h3 style="margin-bottom: 5px;">연습 모드</h3>
        <button id="start-quiz-btn">선택한 과목으로 퀴즈 시작</button>
        <button id="review-btn">오답 노트 풀기 (${INCORRECT_LOG.length}개)</button>
        <button id="problem-list-btn">문제 목록 보기 (전체 ${QUESTIONS_DB.length}개)</button>
        
        <h3 style="margin-bottom: 5px; margin-top: 20px;">시험 모드</h3>
        <button id="exam-start-btn" style="background-color: #dc3545;">⏱️ 국가고시 모의시험 (65문제)</button>
        
        <h3 style="margin-bottom: 5px; margin-top: 20px;">기타</h3>
        <button id="stats-btn" style="background-color: #6c757d;">📊 학습 통계</button>
        <button id="exit-btn">종료 (새로고침)</button>
    `;
    
    document.getElementById('select-all-btn').addEventListener('click', () => {
        document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = true);
    });
    document.getElementById('deselect-all-btn').addEventListener('click', () => {
        document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = false);
    });
    
    document.getElementById('start-quiz-btn').addEventListener('click', handleQuizStart);
    document.getElementById('problem-list-btn').addEventListener('click', showProblemList);
    document.getElementById('exam-start-btn').addEventListener('click', handleExamStart); 
    document.getElementById('stats-btn').addEventListener('click', showStatsScreen);
    
    const reviewBtn = document.getElementById('review-btn');
    reviewBtn.addEventListener('click', startReviewQuiz);
    if (INCORRECT_LOG.length === 0) {
        reviewBtn.disabled = true;
    }
    
    document.getElementById('exit-btn').addEventListener('click', () => location.reload());
}
// --- (신규) 문제 목록 표시 ---
function showProblemList() {
    showScreen('problem-list-screen');
    
    const listItemsHTML = QUESTIONS_DB.map(q => {
        const questionPreview = q.question.length > 50 ? q.question.substring(0, 50) + "..." : q.question;
        return `<li class="problem-list-item" data-id="${q.id}">
            <strong>ID ${q.id} (${q.subject}):</strong> ${questionPreview}
        </li>`;
    }).join(''); 

    problemListScreen.innerHTML = `
        <h2>문제 목록</h2>
        <ul class="problem-list-container">
            ${listItemsHTML}
        </ul>
        <button id="list-back-to-main-btn" style="max-width: 800px;">메인 메뉴로 돌아가기</button>
    `;

    document.getElementById('list-back-to-main-btn').addEventListener('click', showMainMenu);
    
    problemListScreen.querySelectorAll('.problem-list-item').forEach(item => {
        item.addEventListener('click', (event) => {
            const questionId = parseInt(event.currentTarget.dataset.id, 10);
            startSingleProblem(questionId);
        });
    });
}

// --- (신규) 단일 문제 풀기 시작 ---
function startSingleProblem(questionId) {
    const question = [QUESTIONS_DB.find(q => q.id === questionId)];
    runQuiz(question, false, true); // isSingleProblemMode = true
}

// --- 2. 퀴즈 시작 처리 (PyQt: handle_quiz_start) ---
function handleQuizStart() {
    const selectedSubjects = Array.from(document.querySelectorAll('.subject-checkbox:checked'))
                                  .map(cb => cb.value);
    
    if (selectedSubjects.length === 0) {
        alert("하나 이상의 과목을 선택해주세요."); 
        return;
    }
    
    questionsForQuiz = QUESTIONS_DB.filter(q => selectedSubjects.includes(q.subject));
    showNumSelectScreen();
}

// --- 3. 문제 수 선택 (PyQt: select_num_questions) ---
function showNumSelectScreen() {
    showScreen('num-select-screen'); 
    const total_questions = questionsForQuiz.length;
    numSelectScreen.innerHTML = `
        <h2>몇 문제를 푸시겠습니까?</h2>
        <p style="font-size: 22px;">(선택된 과목 총 ${total_questions}개)</p>
        <select id="num-combo">
            <option>10</option>
            <option>20</option>
            <option>30</option>
            <option>50</option>
            <option>사용자 지정</option>
        </select>
        <button id="start-btn">시작</button>
        <button id="num-back-to-main-btn">뒤로가기</button>
    `;
    
    document.getElementById('start-btn').addEventListener('click', startQuizHandler);
    document.getElementById('num-back-to-main-btn').addEventListener('click', showMainMenu);
}

// --- 4. 문제 수 핸들러 (PyQt: start_quiz_handler) ---
function startQuizHandler() {
    const choice = document.getElementById('num-combo').value;
    if (choice === "사용자 지정") {
        showCustomNumScreen();
    } else {
        prepareAndRunQuiz(parseInt(choice, 10));
    }
}

// --- 5. 사용자 지정 문제 수 (PyQt: get_custom_number) ---
function showCustomNumScreen() {
    showScreen('custom-num-screen'); 
    customNumScreen.innerHTML = `
        <h2>문제 수를 입력하세요 (최대 ${questionsForQuiz.length}개):</h2>
        <input type="text" id="custom-num-input" inputmode="numeric" pattern="[0-9]*">
        <button id="ok-btn">확인</button>
        <button id="cancel-btn">취소</button>
    `;
    
    document.getElementById('ok-btn').addEventListener('click', customNumberEntered);
    document.getElementById('cancel-btn').addEventListener('click', showNumSelectScreen);
}

// --- 6. 사용자 지정 수 입력 처리 (PyQt: custom_number_entered) ---
function customNumberEntered() {
    const numText = document.getElementById('custom-num-input').value;
    if (numText && !isNaN(numText)) {
        const num = parseInt(numText, 10);
        if (num > 0) {
            prepareAndRunQuiz(num);
        } else {
            alert("1 이상의 숫자를 입력해주세요."); 
        }
    } else {
        alert("숫자만 입력해주세요."); 
    }
}

// --- 7. 퀴즈 준비 (PyQt: prepare_and_run_quiz) ---
function prepareAndRunQuiz(num) {
    const available_questions_count = questionsForQuiz.length;
    let questions_to_run_count = num;

    if (num > available_questions_count) {
        questions_to_run_count = available_questions_count;
    }
    
    const shuffled = [...questionsForQuiz].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, questions_to_run_count);
    runQuiz(questions);
}

// --- 8. 퀴즈 실행 (PyQt: run_quiz) ---
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

    if (isExamMode) {
        startTimer();
    }

    showQuestion();
}

// --- 9. 문제 표시 (PyQt: show_question) ---
function showQuestion() {
    problemStartTime = new Date(); 

    showScreen('quiz-screen');
    const q = currentQuestions[currentIndex];
    
    const timerDisplay = document.getElementById('timer-display'); 

    let backBtnHTML = '';
    let submitBtnText = '제출';

    if (isSingleProblemMode) {
        backBtnHTML = '<button id="back-to-list-btn" class="back-button">&lt;</button>';
        if (timerDisplay) timerDisplay.style.display = 'none'; 
    } else if (isExamMode) {
        submitBtnText = (currentIndex === currentQuestions.length - 1) ? '결과 보기' : '다음 문제'; 
        if (timerDisplay) {
            timerDisplay.style.display = 'block'; 
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    } else {
        if (timerDisplay) timerDisplay.style.display = 'none'; 
    }

    let inputHTML = '';
    if (q.type === "multiple_choice") {
        const optionsHTML = q.options.map(option => `
            <label class="option-label">
                <input type="radio" name="answer" value="${option.split('.')[0]}">
                ${option}
            </label>
        `).join('');
        inputHTML = `<div class="options-container">${optionsHTML}</div>`;
    } else { 
        inputHTML = `
            <input type="text" id="answer-input" placeholder="정답을 입력하세요">
        `;
    }

    const quizContentWrapper = document.getElementById('quiz-content-wrapper');
    if (quizContentWrapper) {
        quizContentWrapper.innerHTML = `
            ${backBtnHTML}
            <img id="quiz-image" src="${q.image_path}" alt="문제 이미지 (${q.image_path})" onerror="this.src=''; this.alt='이미지 로드 실패: ${q.image_path}';">
            <p id="question-text">문제 ${currentIndex + 1}/${currentQuestions.length}\n\n${q.question}</p>
            <div id="feedback-label"></div>
            ${inputHTML}
            <div id="button-container">
                <button id="submit-btn">${submitBtnText}</button>
            </div>
        `;
    }
    
    document.getElementById('submit-btn').addEventListener('click', checkAnswer);

    if (isSingleProblemMode) {
        document.getElementById('back-to-list-btn').addEventListener('click', showProblemList);
    }
}

// --- 10. 정답 확인 (PyQt: check_answer) ---
function checkAnswer() {
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true; 
    }
    
    const q = currentQuestions[currentIndex];
    
    let optionsToDisable = [];
    if (q.type === "multiple_choice") {
        optionsToDisable = document.querySelectorAll('input[name="answer"]');
    } else {
        const inputField = document.getElementById('answer-input');
        if (inputField) optionsToDisable = [inputField];
    }
    optionsToDisable.forEach(el => el.disabled = true);


    const feedbackLabel = document.getElementById('feedback-label');
    let userAns = "";

    if (q.type === "multiple_choice") {
        const checkedRadio = document.querySelector('input[name="answer"]:checked');
        if (!checkedRadio) {
            alert("답을 선택하세요.");
            if (submitBtn) submitBtn.disabled = false;
            optionsToDisable.forEach(el => el.disabled = false);
            return;
        } else {
            userAns = checkedRadio.value;
        }
    } else {
        const inputField = document.getElementById('answer-input');
        userAns = inputField.value.trim();
        if (!userAns) {
            alert("답을 입력하세요.");
            if (submitBtn) submitBtn.disabled = false;
            optionsToDisable.forEach(el => el.disabled = false);
            return;
        }
    }
    
    if (submitBtn && !isExamMode) { 
        submitBtn.style.display = 'none';
    }

    let feedbackText = "";
    const buttonContainer = document.getElementById('button-container');
    let isCorrect = (userAns === q.answer); 

    const timeTaken = new Date() - problemStartTime;
    problemTimes.push({ 
        questionText: q.question, 
        time: timeTaken 
    });

    if (isExamMode) {
        if (isCorrect) {
            score++;
        }
        if (!isCorrect && !newIncorrect.includes(q.id)) {
            newIncorrect.push(q.id);
        }
        
        // ▼▼▼ [버그 수정] 시험 모드 결과 저장 ▼▼▼
        currentQuizResults.push({
            subject: q.subject || "기타",
            isCorrect: isCorrect
        });
        // ▲▲▲ [버그 수정] ▲▲▲
    }
    
    if (!isReviewMode && !isSingleProblemMode && !isExamMode) {
        currentQuizResults.push({
            subject: q.subject || "기타",
            isCorrect: isCorrect
        });
    }
    
    if (isExamMode) {
        goToNextQuestionOrFinish(); 
        return; 
    }

    // --- (이하는 연습/리뷰/단일 모드 로직) ---

    if (isCorrect) {
        feedbackText = "✅ 정답입니다!";
        document.body.className = 'correct-feedback';
        feedbackLabel.className = 'correct';
        if (!isExamMode) score++; 
        
        if (isReviewMode && INCORRECT_LOG.includes(q.id)) {
            INCORRECT_LOG = INCORRECT_LOG.filter(id => id !== q.id);
        }
        
        if (isSingleProblemMode) { 
            setTimeout(() => { 
                const returnBtn = document.createElement('button');
                returnBtn.id = 'return-btn';
                returnBtn.textContent = '목록으로 돌아가기';
                returnBtn.onclick = showProblemList;
                if(buttonContainer) buttonContainer.appendChild(returnBtn);
            }, 1200);
        } else {
            setTimeout(goToNextQuestionOrFinish, 1200);
        }

    } else {
        feedbackText = `❌ 오답입니다. 정답: ${q.answer}\n[해설] ${q.explanation}`;
        document.body.className = 'incorrect-feedback';
        feedbackLabel.className = 'incorrect';
        if (!isReviewMode && !newIncorrect.includes(q.id)) {
            newIncorrect.push(q.id);
        }

        const nextBtn = document.createElement('button');
        if (isSingleProblemMode) { 
            nextBtn.id = 'return-btn';
            nextBtn.textContent = '목록으로 돌아가기';
            nextBtn.onclick = showProblemList;
        } else {
            nextBtn.id = 'next-btn';
            nextBtn.textContent = '다음 문제';
            nextBtn.onclick = goToNextQuestionOrFinish;
        }
        if(buttonContainer) buttonContainer.appendChild(nextBtn);
    }
    
    feedbackLabel.textContent = feedbackText;
}

// --- 11. 다음 문제 이동 (PyQt: go_to_next_question_or_finish) ---
function goToNextQuestionOrFinish() {
    if (!isExamMode) {
        document.body.className = ''; 
    }

    currentIndex++;
    if (currentIndex < currentQuestions.length) {
        showQuestion();
    } else {
        finishQuiz();
    }
}

// --- 12. 퀴즈 종료 (PyQt: finish_quiz) ---
function finishQuiz() {
    stopTimer(); 

    if (!isReviewMode && !isSingleProblemMode && !isExamMode && currentQuizResults.length > 0) {
        currentQuizResults.forEach(result => {
            if (!QUIZ_STATS[result.subject]) { 
                QUIZ_STATS[result.subject] = { correct: 0, total: 0 };
            }
            QUIZ_STATS[result.subject].total += 1;
            if (result.isCorrect) {
                QUIZ_STATS[result.subject].correct += 1;
            }
        });
        saveQuizStats();
    } 
    else if (isExamMode && currentQuizResults.length > 0) {
        const subjectBreakdown = {}; 
        
        currentQuizResults.forEach(result => {
            if (!subjectBreakdown[result.subject]) {
                subjectBreakdown[result.subject] = { correct: 0, total: 0 };
            }
            subjectBreakdown[result.subject].total += 1;
            if (result.isCorrect) {
                subjectBreakdown[result.subject].correct += 1;
            }
        });

        const newSession = {
            date: new Date().toISOString(), 
            total: currentQuestions.length, 
            correct: score, 
            incorrectIds: newIncorrect, 
            subjectBreakdown: subjectBreakdown 
        };

        EXAM_HISTORY.push(newSession);
        saveExamHistory();
    }

    if (!isReviewMode && !isSingleProblemMode) { 
        const updatedLog = [...new Set([...INCORRECT_LOG, ...newIncorrect])].sort((a, b) => a - b);
        INCORRECT_LOG = updatedLog;
        saveIncorrectLog();
    } 
    else if (isReviewMode) { 
        saveIncorrectLog();
    }
    
    showScreen('results-screen');
    const total = currentQuestions.length;
    const incorrectCount = newIncorrect.length;
    const accuracy = total > 0 ? (score / total) * 100 : 0;

    const totalTimeTaken = new Date() - quizStartTime;
    const minutes = Math.floor(totalTimeTaken / 60000);
    const seconds = Math.floor((totalTimeTaken % 60000) / 1000);
    const totalTimeText = `${minutes}분 ${seconds}초`;

    let slowestProblemText = "N/A";
    if (problemTimes.length > 0) {
        const slowestProblem = problemTimes.reduce((max, current) => {
            return current.time > max.time ? current : max;
        });
        const slowestTimeSeconds = (slowestProblem.time / 1000).toFixed(1);
        slowestProblemText = `(${slowestTimeSeconds}초) ${slowestProblem.questionText.substring(0, 50)}...`;
    }

    const resultTitle = isExamMode ? "📝 시험 결과" : "📊 퀴즈 결과";

    resultsScreen.innerHTML = `
        <h2>${resultTitle}</h2>
        
        <div class="donut-chart-container">
            <div class="donut-chart" style="--accuracy: ${accuracy}%"></div>
            <div class="donut-chart-center">${accuracy.toFixed(1)}%</div>
        </div>
        
        <p style="font-size: 22px; text-align: center; line-height: 1.6;">
            총 문제: ${total}개<br>
            맞힌 개수: ${score}개<br>
            틀린 개수: ${incorrectCount}개
        </p>

        <div style="background-color: #f8f8f8; padding: 15px; border-radius: 8px; text-align: left; max-width: 600px; width: 100%; margin: 15px 0;">
            <p style="font-size: 18px; margin: 5px 0;"><strong>⏱️ 총 소요 시간:</strong> ${totalTimeText}</p>
            <p style="font-size: 18px; margin: 5px 0;"><strong>🐌 가장 오래 걸린 문제:</strong> ${slowestProblemText}</p>
        </div>
        
        <button id="review-new-mistakes-btn">방금 틀린 문제 복습하기 (${incorrectCount}개)</button>
        <button id="result-back-to-main-btn">메인 메뉴로 돌아가기</button>
    `;
    
    const reviewBtn = document.getElementById('review-new-mistakes-btn');
    if (incorrectCount === 0) {
        reviewBtn.disabled = true;
    }
    
    if (isExamMode) {
        reviewBtn.style.display = 'none';
    }
    
    reviewBtn.addEventListener('click', () => reviewMistakes(newIncorrect));
    document.getElementById('result-back-to-main-btn').addEventListener('click', showMainMenu);
}

// --- 13. 틀린 문제 복습 (PyQt: review_mistakes) ---
function reviewMistakes(incorrectIds) {
    if (!incorrectIds || !Array.isArray(incorrectIds) || incorrectIds.length === 0) {
        alert("복습할 틀린 문제가 없습니다.");
        showMainMenu();
        return;
    }
    const reviewQuestions = QUESTIONS_DB.filter(q => incorrectIds.includes(q.id));
    if (reviewQuestions.length === 0) {
        alert("틀린 문제 정보를 찾을 수 없습니다.");
        showMainMenu();
        return;
    }
    runQuiz(reviewQuestions); 
}

// --- 14. 오답 노트 풀기 (PyQt: start_review_quiz) ---
function startReviewQuiz() {
    if (!INCORRECT_LOG || INCORRECT_LOG.length === 0) {
        alert("오답 노트에 문제가 없습니다.");
        return;
    }
    const reviewQuestions = QUESTIONS_DB.filter(q => INCORRECT_LOG.includes(q.id));
    runQuiz(reviewQuestions, true); 
}

// --- (신규) 3. 학습 통계 화면 표시 ---
function showStatsScreen() {
    showScreen('stats-screen');

    const { practiceStatsHTML, weakSubject, strongSubject, overallAccuracy, totalAttempts } = generatePracticeStats();
    const examHistoryHTML = renderExamHistoryGraph();

    statsScreen.innerHTML = `
        <h2>📊 학습 통계</h2>
        
        <div style="display: flex; width: 100%; max-width: 800px; border-bottom: 2px solid #eee; margin-bottom: 20px;">
            <button id="tab-practice" class="tab-btn active">연습 통계</button>
            <button id="tab-exam" class="tab-btn">시험 이력</button>
        </div>
        
        <div id="practice-stats-content" class="tab-content active">
            <div class="stats-summary">
                <div class="summary-box total">
                    <h4>총 정답률</h4>
                    <p>${overallAccuracy.toFixed(1)}%</p>
                </div>
                <div class="summary-box total">
                    <h4>누적 푼 문제</h4>
                    <p>${totalAttempts}개</p>
                </div>
            </div>
            <div class="stats-summary">
                <div class="summary-box weak">
                    <h4>📉 취약 과목</h4>
                    <p>${weakSubject.name}</p>
                    <span style="font-size: 16px;">(정답률 ${weakSubject.accuracy.toFixed(1)}%)</span>
                </div>
                <div class="summary-box strong">
                    <h4>📈 우수 과목</h4>
                    <p>${strongSubject.name}</p>
                    <span style="font-size: 16px;">(정답률 ${strongSubject.accuracy.toFixed(1)}%)</span>
                </div>
            </div>
            <h3>과목별 정답률 (정답률 순)</h3>
            ${practiceStatsHTML} 
        </div>

        <div id="exam-stats-content" class="tab-content">
            <h3>국가고시 모의시험 이력 (최근 10회)</h3>
            ${examHistoryHTML} 
        </div>
        
        <button id="stats-back-to-main-btn" style="margin-top: 30px;">메인 메뉴로 돌아가기</button>

        <div id="session-modal" class="modal-backdrop">
            <div id="modal-content-inner" class="modal-content">
                </div>
        </div>
    `;

    document.getElementById('stats-back-to-main-btn').addEventListener('click', showMainMenu);

    const tabPractice = document.getElementById('tab-practice');
    const tabExam = document.getElementById('tab-exam');
    const contentPractice = document.getElementById('practice-stats-content');
    const contentExam = document.getElementById('exam-stats-content');
    
    tabPractice.addEventListener('click', () => {
        tabPractice.classList.add('active');
        tabExam.classList.remove('active');
        contentPractice.classList.add('active');
        contentExam.classList.remove('active');
    });
    
    tabExam.addEventListener('click', () => {
        tabExam.classList.add('active');
        tabPractice.classList.remove('active');
        contentExam.classList.add('active');
        contentPractice.classList.remove('active');
    });
    
    contentExam.addEventListener('click', (event) => {
        const bar = event.target.closest('.bar-vertical');
        if (bar) {
            const sessionIndex = parseInt(bar.dataset.index, 10);
            showExamSessionDetail(sessionIndex);
        }
    });
    
    document.getElementById('session-modal').addEventListener('click', (event) => {
        if (event.target.id === 'session-modal') { 
            closeModal();
        }
    });
}

// --- (신규) 1. 연습 통계 HTML 생성 (기존 showStatsScreen 로직 분리) ---
function generatePracticeStats() {
    let totalCorrect = 0;
    let totalAttempts = 0;
    let subjectStats = []; 

    for (const subject in QUIZ_STATS) {
        const stats = QUIZ_STATS[subject];
        totalCorrect += stats.correct;
        totalAttempts += stats.total;
        
        let accuracy = 0;
        if (stats.total > 0) {
            accuracy = (stats.correct / stats.total) * 100;
        }
        subjectStats.push({ name: subject, correct: stats.correct, total: stats.total, accuracy: accuracy });
    }

    const overallAccuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

    const MIN_ATTEMPTS = 10;
    const analyzedSubjects = subjectStats.filter(s => s.total >= MIN_ATTEMPTS);
    let weakSubject = { name: "N/A", accuracy: 101 };
    let strongSubject = { name: "N/A", accuracy: -1 };

    if (analyzedSubjects.length > 0) {
        weakSubject = analyzedSubjects.reduce((min, s) => s.accuracy < min.accuracy ? s : min);
        strongSubject = analyzedSubjects.reduce((max, s) => s.accuracy > max.accuracy ? s : max);
    }
    
    subjectStats.sort((a, b) => b.accuracy - a.accuracy); 
    
    const barGraphHTML = subjectStats.map(s => {
        let barClass = '';
        if (s.total > 0) {
            if (s.accuracy >= 75) barClass = 'high-accuracy';
            else if (s.accuracy < 40) barClass = 'low-accuracy';
        }
        
        return `
            <div class="bar-item">
                <div class="bar-label" title="${s.name}">${s.name}</div>
                <div class="bar-wrapper">
                    <div class="bar ${barClass}" style="width: ${s.accuracy.toFixed(1)}%;">
                        ${s.accuracy >= 50 ? `${s.accuracy.toFixed(1)}%` : ''}
                    </div>
                </div>
                <div class="bar-label" style="width: 100px; text-align: right; font-size: 15px;">(${s.correct}/${s.total})</div>
            </div>
        `;
    }).join('');

    const practiceStatsHTML = `<div class="stats-bar-graph-container">${barGraphHTML}</div>`;
    
    return { practiceStatsHTML, weakSubject, strongSubject, overallAccuracy, totalAttempts };
}

// --- (신규) 2. 시험 이력 세로 막대그래프 렌더링 ---
function renderExamHistoryGraph() {
    if (EXAM_HISTORY.length === 0) {
        return "<p style='text-align: center;'>아직 완료한 시험이 없습니다.</p>";
    }
    
    const recentHistory = EXAM_HISTORY.slice(-10); 
    
    const barsHTML = recentHistory.map((session, index) => {
        const accuracy = (session.correct / session.total) * 100;
        const dateLabel = new Date(session.date).toLocaleDateString('ko-KR', {
            month: '2-digit',
            day: '2-digit'
        });

        return `
            <div class="bar-vertical-wrapper">
                <div class="bar-vertical" data-index="${EXAM_HISTORY.length - recentHistory.length + index}" style="height: ${accuracy}%;">
                    <span class="bar-percentage">${accuracy.toFixed(0)}%</span>
                </div>
                <span class="bar-vertical-label">(${index + 1}회차)</span>
                <span class="bar-vertical-label">${dateLabel}</span>
            </div>
        `;
    }).join('');
    
    return `<div class="exam-bar-graph-container">${barsHTML}</div>`;
}

// --- (신규) 3. 시험 상세 정보 모달 표시 ---
function showExamSessionDetail(sessionIndex) {
    const session = EXAM_HISTORY[sessionIndex];
    if (!session) return;
    
    const accuracy = (session.correct / session.total) * 100;
    const sessionDate = new Date(session.date).toLocaleString('ko-KR');

    let subjectDetailsHTML = "<h4>과목별 정답률</h4>";
    const breakdownStats = [];
    for (const subject in session.subjectBreakdown) {
        const data = session.subjectBreakdown[subject];
        const acc = (data.correct / data.total) * 100;
        breakdownStats.push({ name: subject, correct: data.correct, total: data.total, accuracy: acc });
    }
    
    breakdownStats.sort((a, b) => b.accuracy - a.accuracy); 

    subjectDetailsHTML += breakdownStats.map(s => {
        let barClass = '';
        if (s.accuracy >= 75) barClass = 'high-accuracy';
        else if (s.accuracy < 40) barClass = 'low-accuracy';
        
        return `
            <div class="bar-item">
                <div class="bar-label" title="${s.name}">${s.name}</div>
                <div class="bar-wrapper">
                    <div class="bar ${barClass}" style="width: ${s.accuracy.toFixed(1)}%;">
                        ${s.accuracy >= 50 ? `${s.accuracy.toFixed(1)}%` : ''}
                    </div>
                </div>
                <div class="bar-label" style="width: 100px; text-align: right; font-size: 15px;">(${s.correct}/${s.total})</div>
            </div>
        `;
    }).join('');

    const modalContent = document.getElementById('modal-content-inner');
    modalContent.innerHTML = `
        <h2>${sessionIndex + 1}회차 시험 상세</h2>
        <p><strong>시험 일시:</strong> ${sessionDate}</p>
        <p><strong>총 점수:</strong> ${session.correct} / ${session.total} (${accuracy.toFixed(1)}%)</p>
        <hr>
        ${subjectDetailsHTML}
        <hr>
        <button id="modal-review-btn">틀린 문제 복습하기 (${session.incorrectIds.length}개)</button>
        <button id="modal-close-btn" style="background-color: #6c757d;">닫기</button>
    `;

    document.getElementById('modal-review-btn').addEventListener('click', () => {
        closeModal(); 
        reviewMistakes(session.incorrectIds); 
    });
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    
    document.getElementById('session-modal').classList.add('active');
}

// --- (신규) 4. 모달 닫기 ---
function closeModal() {
    document.getElementById('session-modal').classList.remove('active');
    document.getElementById('modal-content-inner').innerHTML = ''; 
}