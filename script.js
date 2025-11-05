// --- 전역 상태 변수 ---
let QUESTIONS_DB = [];
let INCORRECT_LOG = [];
let questionsForQuiz = [];  // 선택된 과목의 문제들
let currentQuestions = [];  // 현재 풀고 있는 퀴즈 문제들
let currentIndex = 0;
let score = 0;
let newIncorrect = [];
let isReviewMode = false;
const INCORRECT_LOG_KEY = "clinicalPathologyQuizLog"; // localStorage 키

// --- DOM 요소 참조 ---
const appContainer = document.getElementById('app-container');
const loadingScreen = document.getElementById('loading-screen');
const errorMessage = document.getElementById('error-message');
const mainMenuScreen = document.getElementById('main-menu-screen');
const numSelectScreen = document.getElementById('num-select-screen');
const customNumScreen = document.getElementById('custom-num-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');

// --- 앱 초기화 ---
window.addEventListener('DOMContentLoaded', loadApp);

async function loadApp() {
    try {
        await loadQuestionsFromJson();
        loadIncorrectLog();
        if (QUESTIONS_DB.length === 0) {
            throw new Error("questions.json 파일이 비어있습니다.");
        }
        // showScreen('main-menu-screen'); // <-- [수정] showMainMenu에서 직접 호출
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
    document.getElementById(screenId).classList.add('active');
    // 피드백 스타일 초기화
    document.body.className = '';
}

// --- 데이터 로드 (PyQt: load_questions_from_json, load_incorrect_log) ---
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

function saveIncorrectLog() {
    localStorage.setItem(INCORRECT_LOG_KEY, JSON.stringify(INCORRECT_LOG));
}

// --- 1. 메인 메뉴 (PyQt: show_subject_selection_menu) ---
function showMainMenu() {
    showScreen('main-menu-screen'); // <-- [수정] 화면 전환 코드를 각 함수 시작 시 호출
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
        <button id="start-quiz-btn">선택한 과목으로 퀴즈 시작</button>
        <button id="review-btn">오답 노트 풀기 (${INCORRECT_LOG.length}개)</button>
        <button id="exit-btn">종료 (새로고침)</button>
    `;
    
    // 이벤트 리스너 연결
    document.getElementById('select-all-btn').addEventListener('click', () => {
        document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = true);
    });
    document.getElementById('deselect-all-btn').addEventListener('click', () => {
        document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = false);
    });
    document.getElementById('start-quiz-btn').addEventListener('click', handleQuizStart);
    document.getElementById('review-btn').addEventListener('click', startReviewQuiz);
    document.getElementById('exit-btn').addEventListener('click', () => location.reload());
}

// --- 2. 퀴즈 시작 처리 (PyQt: handle_quiz_start) ---
function handleQuizStart() {
    const selectedSubjects = Array.from(document.querySelectorAll('.subject-checkbox:checked'))
                                  .map(cb => cb.value);
    
    if (selectedSubjects.length === 0) {
        alert("하나 이상의 과목을 선택해주세요."); // (PyQt: QMessageBox.warning)
        return;
    }
    
    questionsForQuiz = QUESTIONS_DB.filter(q => selectedSubjects.includes(q.subject));
    showNumSelectScreen();
}

// --- 3. 문제 수 선택 (PyQt: select_num_questions) ---
function showNumSelectScreen() {
    showScreen('num-select-screen'); // <-- [수정] 화면 전환 코드 추가
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
        <button id="back-to-main-btn">뒤로가기</button>
    `;
    
    document.getElementById('start-btn').addEventListener('click', startQuizHandler);
    document.getElementById('back-to-main-btn').addEventListener('click', showMainMenu);
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
    showScreen('custom-num-screen'); // <-- [수정] 화면 전환 코드 추가
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
        // Python 코드와 동일한 로직
        if (num > 0) {
            prepareAndRunQuiz(num);
        } else {
            alert("1 이상의 숫자를 입력해주세요."); // (PyQt: QMessageBox.warning)
        }
    } else {
        alert("숫자만 입력해주세요."); // (PyQt: QMessageBox.warning)
    }
}

// --- 7. 퀴즈 준비 (PyQt: prepare_and_run_quiz) ---
function prepareAndRunQuiz(num) {
    const available_questions_count = questionsForQuiz.length;
    let questions_to_run_count = num;

    // Python 코드와 동일한 로직: 문제 수가 가용 수보다 많으면 자동 조절
    if (num > available_questions_count) {
        questions_to_run_count = available_questions_count;
    }
    
    // 문제 섞기 (random.sample)
    const shuffled = [...questionsForQuiz].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, questions_to_run_count);
    runQuiz(questions);
}

// --- 8. 퀴즈 실행 (PyQt: run_quiz) ---
function runQuiz(questionList, isReview = false) {
    currentQuestions = questionList;
    currentIndex = 0;
    score = 0;
    newIncorrect = [];
    isReviewMode = isReview;
    
    // ▼▼▼ 추가 ▼▼▼
    quizStartTime = new Date(); // 퀴즈 시작 시간 기록
    problemTimes = []; // 문제별 소요 시간 기록용 배열
    // ▲▲▲ 추가 ▲▲▲

    showQuestion();
}

// --- 9. 문제 표시 (PyQt: show_question) ---
function showQuestion() {
    // ▼▼▼ 추가 ▼▼▼
    problemStartTime = new Date(); // 현재 문제 시작 시간 기록
    // ▲▲▲ 추가 ▲▲▲

    showScreen('quiz-screen');
    const q = currentQuestions[currentIndex];
    // ... (이하 코드는 기존과 동일) ...
    
    let inputHTML = '';
    if (q.type === "multiple_choice") {
        const optionsHTML = q.options.map(option => `
            <label class="option-label">
                <input type="radio" name="answer" value="${option.split('.')[0]}">
                ${option}
            </label>
        `).join('');
        inputHTML = `<div class="options-container">${optionsHTML}</div>`;
    } else { // 주관식
        inputHTML = `
            <input type="text" id="answer-input" placeholder="정답을 입력하세요">
        `;
    }

    quizScreen.innerHTML = `
        <img id="quiz-image" src="${q.image_path}" alt="문제 이미지 (${q.image_path})" onerror="this.src=''; this.alt='이미지 로드 실패: ${q.image_path}';">
        <p id="question-text">문제 ${currentIndex + 1}/${currentQuestions.length}\n\n${q.question}</p>
        <div id="feedback-label"></div>
        ${inputHTML}
        <div id="button-container">
            <button id="submit-btn">제출</button>
        </div>
        `;
    
    document.getElementById('submit-btn').addEventListener('click', checkAnswer);
}

// --- 10. 정답 확인 (PyQt: check_answer) ---
function checkAnswer() {
    // ▼▼▼ 수정: 제출 버튼 비활성화로 중복 클릭 방지 ▼▼▼
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true; // 클릭 즉시 비활성화
    }
    
    const q = currentQuestions[currentIndex];
    
    // ▼▼▼ 추가: 모든 입력 필드 비활성화 ▼▼▼
    if (q.type === "multiple_choice") {
        document.querySelectorAll('input[name="answer"]').forEach(radio => {
            radio.disabled = true;
        });
    } else {
        const inputField = document.getElementById('answer-input');
        if (inputField) inputField.disabled = true;
    }
    // ▲▲▲ 추가 ▲▲▲

    const feedbackLabel = document.getElementById('feedback-label');
    let userAns = "";

    if (q.type === "multiple_choice") {
        const checkedRadio = document.querySelector('input[name="answer"]:checked');
        if (!checkedRadio) {
            alert("답을 선택하세요.");
            // ▼▼▼ 수정: 비활성화/버튼 복구 ▼▼▼
            if (submitBtn) submitBtn.disabled = false; // 버튼 활성화
            document.querySelectorAll('input[name="answer"]').forEach(radio => {
                radio.disabled = false; // 라디오 버튼 활성화
            });
            // ▲▲▲ 수정 ▲▲▲
            return;
        }
        userAns = checkedRadio.value;
    } else {
        const inputField = document.getElementById('answer-input');
        userAns = inputField.value.trim();
        if (!userAns) {
            alert("답을 입력하세요.");
            // ▼▼▼ 수정: 비활성화/버튼 복구 ▼▼▼
            if (submitBtn) submitBtn.disabled = false; // 버튼 활성화
            if (inputField) inputField.disabled = false; // 입력 필드 활성화
            // ▲▲▲ 수정 ▲▲▲
            return;
        }
    }
    
    // 유효성 검사 통과 후 '제출' 버튼 숨기기
    if (submitBtn) submitBtn.style.display = 'none';

    let feedbackText = "";
    if (userAns === q.answer) {
        feedbackText = "✅ 정답입니다!";
        document.body.className = 'correct-feedback';
        feedbackLabel.className = 'correct';
        score++;
        if (isReviewMode && INCORRECT_LOG.includes(q.id)) {
            INCORRECT_LOG = INCORRECT_LOG.filter(id => id !== q.id);
        }
        
        // 정답: 1.2초 뒤 자동 이동
        setTimeout(goToNextQuestionOrFinish, 1200);

    } else {
        feedbackText = `❌ 오답입니다. 정답: ${q.answer}\n[해설] ${q.explanation}`;
        document.body.className = 'incorrect-feedback';
        feedbackLabel.className = 'incorrect';
        if (!isReviewMode && !newIncorrect.includes(q.id)) {
            newIncorrect.push(q.id);
        }

        // 오답: "다음 문제" 버튼 생성
        const nextBtn = document.createElement('button');
        nextBtn.id = 'next-btn';
        nextBtn.textContent = '다음 문제';
        nextBtn.onclick = goToNextQuestionOrFinish; // 클릭 시 다음 문제로 이동
        
        const buttonContainer = document.getElementById('button-container');
        if(buttonContainer) buttonContainer.appendChild(nextBtn);
    }
    
    feedbackLabel.textContent = feedbackText;
// ▼▼▼ 추가: 문제 소요 시간 기록 ▼▼▼
    const timeTaken = new Date() - problemStartTime;
    problemTimes.push({ 
        questionText: q.question, 
        time: timeTaken 
    });
    // ▲▲▲ 추가 ▲▲▲
}

// --- 11. 다음 문제 이동 (PyQt: go_to_next_question_or_finish) ---
function goToNextQuestionOrFinish() {
    document.body.className = ''; // 배경색 초기화
    currentIndex++;
    if (currentIndex < currentQuestions.length) {
        showQuestion();
    } else {
        finishQuiz();
    }
}

// --- 12. 퀴즈 종료 (PyQt: finish_quiz) ---
function finishQuiz() {
    if (isReviewMode) {
        saveIncorrectLog();
    } else {
        const updatedLog = [...new Set([...INCORRECT_LOG, ...newIncorrect])].sort((a, b) => a - b);
        INCORRECT_LOG = updatedLog;
        saveIncorrectLog();
    }
    
    showScreen('results-screen');
    const total = currentQuestions.length;
    const incorrectCount = newIncorrect.length;
    const accuracy = total > 0 ? (score / total) * 100 : 0;

    // ▼▼▼ 추가: 시간 계산 ▼▼▼
    // 총 소요 시간 계산
    const totalTimeTaken = new Date() - quizStartTime;
    const minutes = Math.floor(totalTimeTaken / 60000);
    const seconds = Math.floor((totalTimeTaken % 60000) / 1000);
    const totalTimeText = `${minutes}분 ${seconds}초`;

    // 가장 오래 걸린 문제 찾기
    let slowestProblemText = "N/A";
    if (problemTimes.length > 0) {
        const slowestProblem = problemTimes.reduce((max, current) => {
            return current.time > max.time ? current : max;
        });
        const slowestTimeSeconds = (slowestProblem.time / 1000).toFixed(1);
        slowestProblemText = `(${slowestTimeSeconds}초) ${slowestProblem.questionText.substring(0, 50)}...`;
    }
    // ▲▲▲ 추가 ▲▲▲

    // (PyQt: ResultsDialog)
    resultsScreen.innerHTML = `
        <h2>📊 퀴즈 결과</h2>
        
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
        <button id="back-to-main-menu-btn">메인 메뉴로 돌아가기</button>
    `;
    
    const reviewBtn = document.getElementById('review-new-mistakes-btn');
    if (incorrectCount === 0) {
        reviewBtn.disabled = true;
    }
    
    reviewBtn.addEventListener('click', () => reviewMistakes(newIncorrect));
    document.getElementById('back-to-main-menu-btn').addEventListener('click', showMainMenu);
}

// --- 13. 틀린 문제 복습 (PyQt: review_mistakes) ---
function reviewMistakes(incorrectIds) {
    if (!incorrectIds || incorrectIds.length === 0) {
        alert("방금 푼 문제 중 틀린 문제가 없습니다.");
        showMainMenu();
        return;
    }
    const reviewQuestions = QUESTIONS_DB.filter(q => incorrectIds.includes(q.id));
    runQuiz(reviewQuestions); // 이 모드는 '방금 푼' 문제 리뷰이므로 isReviewMode=false
}

// --- 14. 오답 노트 풀기 (PyQt: start_review_quiz) ---
function startReviewQuiz() {
    if (!INCORRECT_LOG || INCORRECT_LOG.length === 0) {
        alert("오답 노트에 문제가 없습니다.");
        return;
    }
    const reviewQuestions = QUESTIONS_DB.filter(q => INCORRECT_LOG.includes(q.id));
    runQuiz(reviewQuestions, true); // 오답 노트 모드 활성화
}
