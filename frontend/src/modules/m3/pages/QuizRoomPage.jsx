import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge
} from '../../../shared/components/index.js';
import { formatScore } from '../../../shared/lib/formatters.js';
import {
  saveQuizAnswer,
  startQuizAttempt,
  submitQuizAttempt
} from '../api/attempts.js';

const saveDebounceMs = 300;
const maximumRetryDelayMs = 30_000;

function getTabInstanceId(quizId) {
  const storageKey = `m3.quiz.clientInstanceId.${quizId}`;
  const existingId = window.sessionStorage.getItem(storageKey);
  if (existingId) return existingId;
  if (typeof window.crypto?.randomUUID !== 'function') {
    throw new Error('Trình duyệt không hỗ trợ tạo mã phiên an toàn cho tab này.');
  }

  const instanceId = window.crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, instanceId);
  return instanceId;
}

function safeAttemptQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map((question) => ({
    id: question.id,
    content: question.content,
    orderIndex: question.orderIndex,
    options: Array.isArray(question.options)
      ? question.options.map((option) => ({
          id: option.id,
          content: option.content,
          orderIndex: option.orderIndex
        }))
      : []
  }));
}

function formatRemainingTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function remainingFromClock(clock) {
  if (!clock) return 0;
  const elapsed = Math.floor((performance.now() - clock.startedAt) / 1000);
  return Math.max(0, clock.remainingSeconds - elapsed);
}

function QuizRoomSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 p-4 sm:p-6" role="status">
      <span className="sr-only">Đang tải lượt thi...</span>
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}

function SubmissionResult({ result }) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl content-center gap-5 p-4 sm:p-8">
      <section className="grid gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Đã nộp bài thi</h1>
        <StatusBadge type="attempt" value={result.status} />
        {result.visibleToStudent && result.score != null ? (
          <p className="text-lg">Điểm: {formatScore(result.score)}</p>
        ) : (
          <p className="text-muted-foreground">Điểm sẽ được công bố sau.</p>
        )}
        <p className="text-sm text-muted-foreground">
          Bài làm đã được lưu. Bạn có thể đóng cửa sổ này.
        </p>
      </section>
    </main>
  );
}
export function QuizRoomPage() {
  const { quizId } = useParams();
  const [tabIdentity, setTabIdentity] = useState({ quizId: null, clientInstanceId: null });
  const clientInstanceId = tabIdentity.quizId === quizId ? tabIdentity.clientInstanceId : null;
  const [startStatus, setStartStatus] = useState('loading');
  const [startError, setStartError] = useState(null);
  const [takeoverRequired, setTakeoverRequired] = useState(false);
  const [takeoverDeclined, setTakeoverDeclined] = useState(false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const attemptRef = useRef(null);
  const [answers, setAnswers] = useState({});
  const answersRef = useRef({});
  const [dirtyAnswers, setDirtyAnswers] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved');
  const [saveError, setSaveError] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine !== false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const clockRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const queueRef = useRef(new Map());
  const saveWorkerRef = useRef(null);
  const flushQueueRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryDelayRef = useRef(saveDebounceMs);
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [submitError, setSubmitError] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const submitInFlightRef = useRef(false);
  const automaticSubmitStartedRef = useRef(false);
  const sessionReplaced = Boolean(saveError?.code === 'SESSION_REPLACED' || submitError?.code === 'SESSION_REPLACED');
  const hasUnsavedAnswers = Object.keys(dirtyAnswers).length > 0;

  const synchronizeClock = useCallback((seconds) => {
    const serverSeconds = Math.max(0, Number(seconds) || 0);
    clockRef.current = { remainingSeconds: serverSeconds, startedAt: performance.now() };
    setRemainingSeconds(serverSeconds);
  }, []);

  const acceptSession = useCallback((response, expectedClientId) => {
    if (response.clientInstanceId !== expectedClientId) {
      throw new Error('Máy chủ trả về phiên làm bài không khớp với tab hiện tại.');
    }
    const questions = safeAttemptQuestions(response.questions);
    const validQuestionIds = new Set(questions.map((question) => String(question.id)));
    const optionsByQuestionId = new Map(
      questions.map((question) => [
        String(question.id),
        new Set(question.options.map((option) => String(option.id)))
      ])
    );
    const nextAnswers = Object.fromEntries(
      (Array.isArray(response.savedAnswers) ? response.savedAnswers : [])
        .filter((answer) => (
          validQuestionIds.has(String(answer.questionId)) &&
          optionsByQuestionId.get(String(answer.questionId))?.has(String(answer.optionId))
        ))
        .map((answer) => [String(answer.questionId), answer.optionId])
    );
    const session = {
      attemptId: response.attemptId,
      clientInstanceId: response.clientInstanceId,
      sessionToken: response.sessionToken,
      startedAt: response.startedAt,
      expiresAt: response.expiresAt,
      questions
    };
    attemptRef.current = session;
    answersRef.current = nextAnswers;
    queueRef.current.clear();
    setAttempt(session);
    setAnswers(nextAnswers);
    setDirtyAnswers({});
    setSaveError(null);
    setSaveStatus('saved');
    synchronizeClock(response.remaining_seconds);
  }, [synchronizeClock]);

  const beginAttempt = useCallback(async (takeOver = false) => {
    if (!clientInstanceId || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setStartStatus('loading');
    setStartError(null);
    setTakeoverRequired(false);
    setTakeoverDeclined(false);
    setTakeoverLoading(takeOver);
    try {
      const response = await startQuizAttempt(quizId, { clientInstanceId, takeOver });
      acceptSession(response, clientInstanceId);
      setStartStatus('success');
    } catch (error) {
      if (error.code === 'SESSION_ACTIVE_ELSEWHERE' && !takeOver) {
        setTakeoverRequired(true);
        setTakeoverDeclined(false);
        setStartStatus('success');
      } else {
        setStartError(error);
        setStartStatus('error');
      }
    } finally {
      requestInFlightRef.current = false;
      setTakeoverLoading(false);
    }
  }, [acceptSession, clientInstanceId, quizId]);

  useEffect(() => {
    attemptRef.current = null;
    queueRef.current.clear();
    answersRef.current = {};
    setAttempt(null);
    setAnswers({});
    setDirtyAnswers({});
    setStartStatus('loading');
    setStartError(null);
    setSubmissionResult(null);
    automaticSubmitStartedRef.current = false;
    try {
      setTabIdentity({ quizId, clientInstanceId: getTabInstanceId(quizId) });
    } catch (error) {
      setStartError(error);
      setStartStatus('error');
    }
  }, [quizId]);

  useEffect(() => {
    if (clientInstanceId) beginAttempt(false);
  }, [beginAttempt, clientInstanceId]);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine !== false);
    }
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  const flushSaveQueue = useCallback(() => {
    if (saveWorkerRef.current) return saveWorkerRef.current;
    if (!isOnline || sessionReplaced || !attemptRef.current) return Promise.resolve(false);

    saveWorkerRef.current = (async () => {
      while (queueRef.current.size && isOnline && !sessionReplaced) {
        const [questionId, entry] = queueRef.current.entries().next().value;
        queueRef.current.delete(questionId);
        setSaveStatus('saving');
        setSaveError(null);
        try {
          const session = attemptRef.current;
          const response = await saveQuizAnswer(session.attemptId, {
            questionId: entry.questionId,
            optionId: entry.optionId,
            clientInstanceId: session.clientInstanceId,
            sessionToken: session.sessionToken
          });
          synchronizeClock(response.remaining_seconds);
          retryDelayRef.current = saveDebounceMs;
          setDirtyAnswers((current) => {
            if (String(answersRef.current[questionId]) !== String(entry.optionId)) {
              return current;
            }
            const next = { ...current };
            delete next[questionId];
            return next;
          });
        } catch (error) {
          if (error.code === 'SESSION_REPLACED') {
            setSaveError(error);
            setSaveStatus('error');
            queueRef.current.clear();
            setDirtyAnswers({});
            return false;
          }
          if (error.code === 'ATTEMPT_EXPIRED') {
            queueRef.current.clear();
            setSaveStatus('saved');
            setRemainingSeconds(0);
            return false;
          }
          if (!queueRef.current.has(questionId)) {
            queueRef.current.set(questionId, entry);
          }
          setSaveError(error);
          setSaveStatus('retrying');
          if (error.code === 'NETWORK_ERROR' || error.status == null) {
            const delay = retryDelayRef.current;
            retryDelayRef.current = Math.min(retryDelayRef.current * 2, maximumRetryDelayMs);
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              flushQueueRef.current?.();
            }, delay);
          } else {
            setSaveStatus('error');
          }
          return false;
        }
      }

      if (!queueRef.current.size) setSaveStatus('saved');
      return queueRef.current.size === 0;
    })().finally(() => {
      saveWorkerRef.current = null;
    });
    return saveWorkerRef.current;
  }, [isOnline, sessionReplaced, synchronizeClock]);

  useEffect(() => {
    flushQueueRef.current = flushSaveQueue;
    return () => {
      flushQueueRef.current = null;
    };
  }, [flushSaveQueue]);

  const scheduleSave = useCallback(() => {
    window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      flushSaveQueue();
    }, saveDebounceMs);
  }, [flushSaveQueue]);

  useEffect(() => {
    if (isOnline && queueRef.current.size && saveStatus === 'retrying' && !retryTimerRef.current) {
      flushSaveQueue();
    }
  }, [flushSaveQueue, isOnline, saveStatus]);

  useEffect(() => () => {
    window.clearTimeout(debounceTimerRef.current);
    window.clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (!attempt || submissionResult) return undefined;
    const interval = window.setInterval(() => {
      setRemainingSeconds(remainingFromClock(clockRef.current));
    }, 250);
    return () => window.clearInterval(interval);
  }, [attempt, submissionResult]);

  const unansweredCount = useMemo(
    () => Math.max(0, (attempt?.questions.length ?? 0) - Object.keys(answers).length),
    [answers, attempt]
  );

  const submitCurrentAttempt = useCallback(async (automatic = false) => {
    const session = attemptRef.current;
    if (!session || submitInFlightRef.current || submissionResult) return;
    submitInFlightRef.current = true;
    setSubmitStatus('loading');
    setSubmitError(null);
    try {
      const result = await submitQuizAttempt(session.attemptId, {
        clientInstanceId: session.clientInstanceId,
        sessionToken: session.sessionToken
      });
      setSubmissionResult(result);
      setSubmitStatus('success');
      setDirtyAnswers({});
      queueRef.current.clear();
      setSaveError(null);
      window.clearTimeout(debounceTimerRef.current);
      window.clearTimeout(retryTimerRef.current);
      if (automatic) setRemainingSeconds(0);
    } catch (error) {
      setSubmitError(error);
      setSubmitStatus('error');
      if (error.code === 'SESSION_REPLACED') {
        queueRef.current.clear();
        setDirtyAnswers({});
      }
    } finally {
      submitInFlightRef.current = false;
    }
  }, [submissionResult]);

  useEffect(() => {
    if (
      remainingSeconds === 0 &&
      attempt &&
      !sessionReplaced &&
      !submissionResult &&
      !automaticSubmitStartedRef.current
    ) {
      automaticSubmitStartedRef.current = true;
      submitCurrentAttempt(true);
    }
  }, [attempt, remainingSeconds, sessionReplaced, submissionResult, submitCurrentAttempt]);

  useEffect(() => {
    if (!hasUnsavedAnswers || submissionResult) return undefined;
    const preventClose = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventClose);
    return () => window.removeEventListener('beforeunload', preventClose);
  }, [hasUnsavedAnswers, submissionResult]);

  function selectAnswer(questionId, optionId) {
    if (!attempt || sessionReplaced || remainingSeconds === 0 || submitStatus === 'loading') return;
    const questionKey = String(questionId);
    const nextAnswers = { ...answersRef.current, [questionKey]: optionId };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setDirtyAnswers((current) => ({ ...current, [questionKey]: true }));
    queueRef.current.set(questionKey, { questionId, optionId });
    setSaveStatus(isOnline ? 'saving' : 'retrying');
    setSaveError(null);
    scheduleSave();
  }

  async function retryStart() {
    automaticSubmitStartedRef.current = false;
    await beginAttempt(false);
  }

  async function handleTakeover() {
    await beginAttempt(true);
  }

  async function handleManualSubmit() {
    if (queueRef.current.size || saveWorkerRef.current) {
      if (!isOnline) {
        setSubmitError(new Error('Không có kết nối mạng. Đáp án chưa lưu; hãy kết nối lại trước khi nộp bài.'));
        setSubmitStatus('error');
        return;
      }
      window.clearTimeout(debounceTimerRef.current);
      const saved = await flushSaveQueue();
      if (!saved) {
        setSubmitError(new Error('Đáp án chưa lưu xong. Hãy thử gửi lại hoặc chờ kết nối ổn định.'));
        setSubmitStatus('error');
        return;
      }
    }
    await submitCurrentAttempt(false);
  }

  function retryPendingSave() {
    if (!isOnline) return;
    setSaveError(null);
    setSaveStatus('saving');
    window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    flushSaveQueue();
  }

  function questionStatus(questionId) {
    return answers[String(questionId)] == null ? 'Chưa trả lời' : 'Đã trả lời';
  }

  if (submissionResult) return <SubmissionResult result={submissionResult} />;
  if (startStatus === 'loading') return <QuizRoomSkeleton />;
  if (startStatus === 'error') {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-3xl content-center gap-4 p-4 sm:p-8">
        <ErrorState
          message={startError?.message || 'Không thể bắt đầu hoặc khôi phục lượt thi.'}
          onRetry={retryStart}
        />
      </main>
    );
  }
  if (takeoverRequired) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-3xl content-center gap-4 p-4 sm:p-8">
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bài thi đang mở ở nơi khác</AlertDialogTitle>
              <AlertDialogDescription>
                Bài thi đang mở ở nơi khác, chuyển sang tab này?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button
                  disabled={takeoverLoading}
                  onClick={() => {
                    setTakeoverRequired(false);
                    setTakeoverDeclined(true);
                  }}
                  variant="outline"
                >
                  Ở lại tab kia
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button disabled={takeoverLoading} onClick={handleTakeover}>
                  {takeoverLoading ? 'Đang chuyển phiên...' : 'Chuyển sang tab này'}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    );
  }
  if (takeoverDeclined) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-3xl content-center gap-4 p-4 sm:p-8">
        <ErrorState
          message="Lượt thi vẫn đang hoạt động ở tab khác. Hãy quay lại tab đó hoặc thử kết nối lại sau."
          onRetry={() => beginAttempt(false)}
        />
      </main>
    );
  }
  if (!attempt) return null;
  if (!attempt.questions.length) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-3xl content-center p-4 sm:p-8">
        <EmptyState
          title="Đề thi chưa có câu hỏi"
          description="Hiện không có câu hỏi để làm bài. Vui lòng liên hệ giảng viên."
        />
      </main>
    );
  }

  const timerWarning =
    remainingSeconds > 0 && remainingSeconds <= 60
      ? 'Còn 1 phút, hãy hoàn tất và nộp bài.'
      : remainingSeconds > 60 && remainingSeconds <= 300
        ? 'Còn 5 phút, hãy kiểm tra lại câu trả lời.'
        : null;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl gap-6 p-4 sm:p-6 lg:p-8">
      <header className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:p-6">
        <div className="grid gap-2">
          <h1 className="text-xl font-semibold">Phòng thi</h1>
          <p className="text-sm text-muted-foreground">Mã đề: {quizId}</p>
        </div>
        <div className="grid justify-items-start gap-2 sm:justify-items-end">
          <p aria-label="Thời gian còn lại" aria-live="polite" className="text-2xl font-semibold tabular-nums">
            {formatRemainingTime(remainingSeconds)}
          </p>
          {timerWarning ? <p className="text-sm text-warning" role="status">{timerWarning}</p> : null}
          {!isOnline ? <p className="text-sm text-destructive" role="alert">Mất kết nối. Đáp án sẽ được giữ và gửi lại khi có mạng.</p> : null}
        </div>
      </header>

      {sessionReplaced ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
          {saveError?.message || submitError?.message || 'Phiên làm bài này đã được thay thế.'}
        </div>
      ) : null}
      {submitError && !sessionReplaced ? (
        <div className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
          <p>{submitError.message || 'Không thể nộp bài.'}</p>
          <Button
            className="w-fit"
            disabled={submitStatus === 'loading'}
            onClick={() => submitCurrentAttempt(remainingSeconds === 0)}
            variant="outline"
          >
            Thử nộp lại
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-label="Câu hỏi trắc nghiệm" className="grid gap-4">
          {attempt.questions.map((question, index) => (
            <fieldset
              className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
              id={`question-${question.id}`}
              key={question.id}
            >
              <legend className="px-1 text-base font-semibold">
                Câu {index + 1}: {question.content}
              </legend>
              <div className="grid gap-2">
                {question.options.map((option) => (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50 has-[:disabled]:cursor-not-allowed has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    key={option.id}
                  >
                    <input
                      checked={String(answers[String(question.id)]) === String(option.id)}
                      className="mt-1 size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={sessionReplaced || remainingSeconds === 0 || submitStatus === 'loading'}
                      name={`attempt-question-${question.id}`}
                      onChange={() => selectAnswer(question.id, option.id)}
                      type="radio"
                    />
                    <span>{option.content}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </section>

        <aside className="h-fit rounded-lg border border-border bg-card p-4 lg:sticky lg:top-4">
          <h2 className="font-semibold">Điều hướng câu hỏi</h2>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
            {attempt.questions.map((question, index) => {
              const answered = answers[String(question.id)] != null;
              return (
                <li key={question.id}>
                  <a
                    aria-label={`Câu ${index + 1}, ${questionStatus(question.id)}`}
                    className={`flex size-10 items-center justify-center rounded-md border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      answered
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground'
                    }`}
                    href={`#question-${question.id}`}
                  >
                    {index + 1}
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid gap-2 border-t border-border pt-4">
            <p aria-live="polite" className="text-sm">
              {saveStatus === 'saved' ? 'Đã lưu' : null}
              {saveStatus === 'saving' ? 'Đang lưu' : null}
              {saveStatus === 'retrying' ? 'Lỗi lưu, đang thử lại' : null}
              {saveStatus === 'error' ? 'Lỗi lưu, cần thử lại' : null}
            </p>
            {saveError && !sessionReplaced ? (
              <div className="grid gap-2">
                <p className="text-sm text-destructive" role="alert">{saveError.message}</p>
                {saveStatus === 'error' ? (
                  <Button disabled={!isOnline} onClick={retryPendingSave} size="sm" variant="outline">
                    Thử lưu lại
                  </Button>
                ) : null}
              </div>
            ) : null}
            {sessionReplaced ? (
              <p className="text-sm text-destructive">Không thể tiếp tục lưu hoặc nộp bằng phiên cũ.</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Đã trả lời {attempt.questions.length - unansweredCount}/{attempt.questions.length}
            </p>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="w-full"
                  disabled={submitStatus === 'loading' || sessionReplaced || remainingSeconds === 0}
                >
                  Nộp bài
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xác nhận nộp bài</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn còn {unansweredCount} câu chưa làm. Sau khi nộp, bạn không thể tiếp tục làm bài.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel asChild>
                    <Button variant="outline">Tiếp tục làm bài</Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      disabled={submitStatus === 'loading'}
                      onClick={handleManualSubmit}
                    >
                      {submitStatus === 'loading' ? 'Đang nộp...' : 'Nộp bài'}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>
      </div>
    </main>
  );
}
