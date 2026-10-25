import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { useApiMutation } from '../../../shared/hooks/useApiMutation.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { formatDateTime } from '../../../shared/lib/formatters.js';
import {
  Button,
  Checkbox,
  DataState,
  DateTimeInput,
  FormDialog,
  FormField,
  Input,
  Label,
  Pagination,
  Skeleton,
  StatusBadge,
  Textarea,
  toast
} from '../../../shared/components/index.js';
import {
  createQuiz,
  getQuiz,
  listCourseQuizzes,
  publishQuiz,
  replaceQuizQuestions,
  updateQuiz
} from '../api/quizzes.js';

const pageLimit = 20;
const emptyForm = {
  title: '',
  description: '',
  duration_minutes: '30',
  open_time: '',
  close_time: '',
  show_score_immediately: true,
  questions: []
};

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function toApiDateTime(value) {
  return value ? `${value.replace('T', ' ')}:00` : '';
}

function toEditorValues(quiz) {
  if (!quiz) return emptyForm;
  return {
    title: quiz.title ?? '',
    description: quiz.description ?? '',
    duration_minutes: String(quiz.durationMinutes ?? 30),
    open_time: toDateTimeLocal(quiz.openTime),
    close_time: toDateTimeLocal(quiz.closeTime),
    show_score_immediately: Boolean(quiz.showScoreImmediately),
    questions: (quiz.questions ?? []).map((question) => ({
      content: question.content ?? '',
      options: (question.options ?? []).map((option) => ({
        content: option.content ?? '',
        is_correct: Boolean(option.isCorrect)
      }))
    }))
  };
}

function emptyQuestion() {
  return {
    content: '',
    options: [
      { content: '', is_correct: true },
      { content: '', is_correct: false }
    ]
  };
}

function validateEditor(values) {
  if (!values.title.trim()) return 'Vui lòng nhập tiêu đề đề thi.';
  if (!Number.isInteger(Number(values.duration_minutes)) || Number(values.duration_minutes) < 1) {
    return 'Thời lượng phải là số phút lớn hơn 0.';
  }
  if (!values.open_time || !values.close_time) {
    return 'Vui lòng chọn thời gian mở và đóng đề.';
  }
  if (values.close_time <= values.open_time) {
    return 'Thời gian đóng đề phải sau thời gian mở đề.';
  }
  for (const [index, question] of values.questions.entries()) {
    if (!question.content.trim()) return `Vui lòng nhập nội dung câu ${index + 1}.`;
    if (question.options.length < 2 || question.options.length > 5) {
      return `Câu ${index + 1} phải có từ 2 đến 5 lựa chọn.`;
    }
    if (question.options.some((option) => !option.content.trim())) {
      return `Vui lòng nhập đầy đủ lựa chọn của câu ${index + 1}.`;
    }
    if (question.options.filter((option) => option.is_correct).length !== 1) {
      return `Câu ${index + 1} phải có đúng một đáp án đúng.`;
    }
  }
  return '';
}

function toRequest(values) {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    duration_minutes: Number(values.duration_minutes),
    open_time: toApiDateTime(values.open_time),
    close_time: toApiDateTime(values.close_time),
    show_score_immediately: values.show_score_immediately
  };
}

function QuizEditorForm({
  quiz,
  pending,
  error,
  fieldErrors,
  onSubmit,
  onCancel
}) {
  const [values, setValues] = useState(() => toEditorValues(quiz));
  const [validationError, setValidationError] = useState('');
  const [serverError, setServerError] = useState('');
  const [savedWithQuestionsError, setSavedWithQuestionsError] = useState(false);

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setValidationError('');
    setServerError('');
    setSavedWithQuestionsError(false);
  }

  function updateQuestion(questionIndex, update) {
    setValues((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex ? update(question) : question
      )
    }));
    setValidationError('');
    setServerError('');
    setSavedWithQuestionsError(false);
  }

  function submit(event) {
    event.preventDefault();
    const issue = validateEditor(values);
    if (issue) {
      setValidationError(issue);
      return;
    }

    const { questions } = values;
    onSubmit(
      {
        ...toRequest(values),
        questions: questions.map((question) => ({
          content: question.content.trim(),
          options: question.options.map((option) => ({
            content: option.content.trim(),
            is_correct: option.is_correct
          }))
        }))
      },
      (metadataWasSaved) => {
        setSavedWithQuestionsError(metadataWasSaved);
        if (metadataWasSaved) {
          setServerError('Thông tin đề đã lưu, nhưng chưa lưu được danh sách câu hỏi. Vui lòng thử lưu lại.');
        }
      }
    );
  }

  return (
    <form className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1" onSubmit={submit}>
      {savedWithQuestionsError ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm" role="alert">
          {serverError}
        </p>
      ) : null}
      <FormField error={fieldErrors.title} id="quiz-title" label="Tiêu đề" required>
        <Input
          autoFocus
          disabled={pending}
          id="quiz-title"
          maxLength={200}
          onChange={(event) => updateField('title', event.target.value)}
          required
          value={values.title}
        />
      </FormField>
      <FormField error={fieldErrors.description} id="quiz-description" label="Mô tả">
        <Textarea
          disabled={pending}
          id="quiz-description"
          onChange={(event) => updateField('description', event.target.value)}
          value={values.description}
        />
      </FormField>
      <FormField
        error={fieldErrors.duration_minutes}
        id="quiz-duration"
        label="Thời lượng (phút)"
        required
      >
        <Input
          disabled={pending}
          id="quiz-duration"
          min="1"
          onChange={(event) => updateField('duration_minutes', event.target.value)}
          required
          type="number"
          value={values.duration_minutes}
        />
      </FormField>
      <FormField
        error={fieldErrors.open_time}
        hint="Thời gian được gửi theo múi giờ máy chủ."
        id="quiz-open-time"
        label="Mở đề"
        required
      >
        <DateTimeInput
          disabled={pending}
          id="quiz-open-time"
          onChange={(event) => updateField('open_time', event.target.value)}
          required
          value={values.open_time}
        />
      </FormField>
      <FormField error={fieldErrors.close_time} id="quiz-close-time" label="Đóng đề" required>
        <DateTimeInput
          disabled={pending}
          id="quiz-close-time"
          onChange={(event) => updateField('close_time', event.target.value)}
          required
          value={values.close_time}
        />
      </FormField>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={values.show_score_immediately}
          disabled={pending}
          id="quiz-show-score"
          onCheckedChange={(checked) => updateField('show_score_immediately', checked === true)}
        />
        <Label htmlFor="quiz-show-score">Cho phép xem điểm ngay sau khi nộp</Label>
      </div>
      <section aria-label="Câu hỏi" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Câu hỏi</h3>
            <p className="text-sm text-muted-foreground">
              Mỗi câu có 2–5 lựa chọn và đúng một đáp án đúng. Đề nháp có thể chưa có câu hỏi.
            </p>
          </div>
          <Button
            disabled={pending}
            onClick={() => updateField('questions', [...values.questions, emptyQuestion()])}
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" className="mr-2 size-4" />
            Thêm câu hỏi
          </Button>
        </div>
        {values.questions.map((question, questionIndex) => (
          <fieldset className="grid gap-3 rounded-md border border-border p-4" key={questionIndex}>
            <legend className="px-1 font-medium">Câu {questionIndex + 1}</legend>
            <FormField id={`quiz-question-${questionIndex}`} label="Nội dung câu hỏi" required>
              <Textarea
                disabled={pending}
                id={`quiz-question-${questionIndex}`}
                onChange={(event) => updateQuestion(questionIndex, (current) => ({
                  ...current,
                  content: event.target.value
                }))}
                required
                value={question.content}
              />
            </FormField>
            <div className="grid gap-3">
              {question.options.map((option, optionIndex) => (
                <div className="grid gap-2 rounded-md bg-muted/40 p-3" key={optionIndex}>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`quiz-option-${questionIndex}-${optionIndex}`}>
                      Lựa chọn {optionIndex + 1}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        aria-label={`Di chuyển lựa chọn ${optionIndex + 1} của câu ${questionIndex + 1} lên`}
                        disabled={pending || optionIndex === 0}
                        onClick={() => updateQuestion(questionIndex, (current) => {
                          const options = [...current.options];
                          [options[optionIndex - 1], options[optionIndex]] =
                            [options[optionIndex], options[optionIndex - 1]];
                          return { ...current, options };
                        })}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Di chuyển lựa chọn ${optionIndex + 1} của câu ${questionIndex + 1} xuống`}
                        disabled={pending || optionIndex === question.options.length - 1}
                        onClick={() => updateQuestion(questionIndex, (current) => {
                          const options = [...current.options];
                          [options[optionIndex], options[optionIndex + 1]] =
                            [options[optionIndex + 1], options[optionIndex]];
                          return { ...current, options };
                        })}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <ArrowDown aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        disabled={pending || question.options.length <= 2}
                        onClick={() => updateQuestion(questionIndex, (current) => ({
                          ...current,
                          options: current.options.filter((_, index) => index !== optionIndex)
                        }))}
                        type="button"
                        variant="ghost"
                      >
                        Xóa lựa chọn
                      </Button>
                    </div>
                  </div>
                  <Input
                    disabled={pending}
                    id={`quiz-option-${questionIndex}-${optionIndex}`}
                    onChange={(event) => updateQuestion(questionIndex, (current) => ({
                      ...current,
                      options: current.options.map((item, index) =>
                        index === optionIndex ? { ...item, content: event.target.value } : item
                      )
                    }))}
                    required
                    value={option.content}
                  />
                  <label className="flex w-fit items-center gap-2 text-sm">
                    <input
                      checked={option.is_correct}
                      className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={pending}
                      name={`quiz-correct-${questionIndex}`}
                      onChange={() => updateQuestion(questionIndex, (current) => ({
                        ...current,
                        options: current.options.map((item, index) => ({
                          ...item,
                          is_correct: index === optionIndex
                        }))
                      }))}
                      type="radio"
                    />
                    Đáp án đúng
                  </label>
                </div>
              ))}
              <Button
                disabled={pending || question.options.length >= 5}
                onClick={() => updateQuestion(questionIndex, (current) => ({
                  ...current,
                  options: [...current.options, { content: '', is_correct: false }]
                }))}
                type="button"
                variant="outline"
              >
                Thêm lựa chọn
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex gap-1">
                <Button
                  aria-label={`Di chuyển câu ${questionIndex + 1} lên`}
                  disabled={pending || questionIndex === 0}
                  onClick={() => updateField(
                    'questions',
                    values.questions.map((item, index) => {
                      if (index === questionIndex - 1) return values.questions[questionIndex];
                      if (index === questionIndex) return values.questions[questionIndex - 1];
                      return item;
                    })
                  )}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowUp aria-hidden="true" className="mr-1 size-4" />
                  Lên
                </Button>
                <Button
                  aria-label={`Di chuyển câu ${questionIndex + 1} xuống`}
                  disabled={pending || questionIndex === values.questions.length - 1}
                  onClick={() => updateField(
                    'questions',
                    values.questions.map((item, index) => {
                      if (index === questionIndex) return values.questions[questionIndex + 1];
                      if (index === questionIndex + 1) return values.questions[questionIndex];
                      return item;
                    })
                  )}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowDown aria-hidden="true" className="mr-1 size-4" />
                  Xuống
                </Button>
              </div>
              <Button
                disabled={pending || (quiz && values.questions.length <= 1)}
                onClick={() => updateField(
                  'questions',
                  values.questions.filter((_, index) => index !== questionIndex)
                )}
                type="button"
                variant="destructive"
              >
                Xóa câu hỏi
              </Button>
            </div>
          </fieldset>
        ))}
        {!values.questions.length ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Chưa có câu hỏi. Thêm câu hỏi để có thể công bố đề.
          </p>
        ) : null}
      </section>
      {validationError ? <p className="text-sm text-destructive" role="alert">{validationError}</p> : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error.message}</p> : null}
      {Object.values(fieldErrors).map((message) => (
        <p className="text-sm text-destructive" key={message} role="alert">{message}</p>
      ))}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button disabled={pending} onClick={onCancel} type="button" variant="outline">
          Hủy
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? 'Đang lưu...' : quiz ? 'Lưu thay đổi' : 'Lưu bản nháp'}
        </Button>
      </div>
    </form>
  );
}

function QuizRow({ quiz, ownerView, canManage, onEdit, onPublish, publishing }) {
  const statusText = {
    NOT_STARTED: 'Chưa làm',
    IN_PROGRESS: 'Đang làm',
    SUBMITTED: 'Đã nộp',
    AUTO_SUBMITTED: 'Tự động nộp'
  }[quiz.attemptStatus] ?? 'Chưa làm';

  return (
    <li className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{quiz.title}</h3>
          <StatusBadge type="quiz" value={quiz.status} />
        </div>
        {quiz.description ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{quiz.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Thời lượng: {quiz.durationMinutes} phút</span>
          <span>Mở: {formatDateTime(quiz.openTime)}</span>
          <span>Đóng: {formatDateTime(quiz.closeTime)}</span>
          {ownerView ? <span>{quiz.questionCount} câu hỏi</span> : <span>{statusText}</span>}
          {ownerView ? (
            <span>{quiz.hasAttempts ? 'Đã có lượt thi' : 'Chưa có lượt thi'}</span>
          ) : quiz.visibleToStudent && quiz.score != null ? (
            <span>Điểm: {quiz.score}</span>
          ) : null}
        </div>
        {!ownerView && !quiz.visibleToStudent ? (
          <p className="text-sm text-muted-foreground">Điểm sẽ được công bố sau.</p>
        ) : null}
        {!ownerView && !quiz.canStart && quiz.attemptStatus === 'NOT_STARTED' ? (
          <p className="text-sm text-muted-foreground">
            {quiz.status === 'CLOSED' ? 'Đề đã đóng.' : 'Hiện chưa thể bắt đầu đề thi.'}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ownerView ? (
          <>
            {canManage ? (
              <Button
                disabled={quiz.hasAttempts}
                onClick={() => onEdit(quiz)}
                size="sm"
                variant="outline"
              >
                <Pencil aria-hidden="true" className="mr-2 size-4" />
                Sửa
              </Button>
            ) : null}
            {canManage && quiz.status === 'DRAFT' ? (
              <Button
                disabled={publishing || quiz.questionCount < 1}
                onClick={() => onPublish(quiz)}
                size="sm"
              >
                {publishing ? 'Đang công bố...' : 'Công bố'}
              </Button>
            ) : null}
            {quiz.hasAttempts ? (
              <p className="basis-full text-sm text-muted-foreground">
                Đề đã có lượt thi nên máy chủ khóa chỉnh sửa (EC-07).
              </p>
            ) : null}
          </>
        ) : (
          quiz.attemptId != null &&
          (quiz.attemptStatus === 'SUBMITTED' || quiz.attemptStatus === 'AUTO_SUBMITTED') ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              to={`/attempts/${encodeURIComponent(quiz.attemptId)}/results`}
            >
              Xem kết quả
            </Link>
          ) : quiz.attemptStatus === 'IN_PROGRESS' ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              to={`/quizzes/${quiz.id}/take`}
            >
              Tiếp tục làm bài
            </Link>
          ) : quiz.attemptId == null && quiz.canStart ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              to={`/quizzes/${quiz.id}/take`}
            >
              Vào thi
            </Link>
          ) : (
            <Button disabled size="sm">
              Vào thi
            </Button>
          )
        )}
      </div>
    </li>
  );
}

export function QuizTab({ courseId, course, role, isOwner = false }) {
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const queryKey = useMemo(() => ['m3', 'quizzes', courseId, role, page], [courseId, role, page]);
  const query = useApiQuery(
    queryKey,
    () => listCourseQuizzes(courseId, { page, limit: pageLimit }),
    { enabled: Boolean(courseId) }
  );
  const ownerView = role === 'GIANG_VIEN' && isOwner;
  const canManage =
    ownerView && Boolean(course) && course.status !== 'ARCHIVED';

  const saveMutation = useApiMutation(
    async (values) => {
      if (!editingQuiz) return createQuiz(courseId, values);
      await updateQuiz(editingQuiz.id, {
        title: values.title,
        description: values.description,
        duration_minutes: values.duration_minutes,
        open_time: values.open_time,
        close_time: values.close_time,
        show_score_immediately: values.show_score_immediately
      });
      if (values.questions.length) {
        try {
          await replaceQuizQuestions(editingQuiz.id, values.questions);
        } catch (error) {
          error.metadataWasSaved = true;
          throw error;
        }
      }
      return editingQuiz;
    },
    {
      invalidate: [queryKey],
      onSuccess: () => {
        toast.success(editingQuiz ? 'Đã cập nhật đề thi.' : 'Đã lưu bản nháp.');
        setEditorOpen(false);
        setEditingQuiz(null);
        setSaveError(null);
      }
    }
  );
  const publishMutation = useApiMutation(
    (quiz) => publishQuiz(quiz.id),
    {
      invalidate: [queryKey],
      onSuccess: () => toast.success('Đã công bố đề thi.')
    }
  );

  function openCreateEditor() {
    setEditingQuiz(null);
    setDetailError(null);
    setSaveError(null);
    setEditorRevision((revision) => revision + 1);
    setEditorOpen(true);
  }

  async function openEditEditor(quiz) {
    setEditingQuiz(null);
    setDetailError(null);
    setSaveError(null);
    setDetailLoading(true);
    setEditorRevision((revision) => revision + 1);
    setEditorOpen(true);
    try {
      const detail = await getQuiz(quiz.id);
      setEditingQuiz(detail);
    } catch (error) {
      setDetailError(error);
    } finally {
      setDetailLoading(false);
    }
  }

  async function save(values, onQuestionFailure) {
    try {
      await saveMutation.mutate(values);
    } catch (error) {
      setSaveError(error);
      onQuestionFailure(Boolean(error?.metadataWasSaved));
    }
  }

  async function handlePublish(quiz) {
    try {
      await publishMutation.mutate(quiz);
    } catch (error) {
      toast.error(error.message || 'Không thể công bố đề thi.');
    }
  }

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageLimit));
  const emptyAction = canManage
    ? { label: 'Tạo đề đầu tiên', onClick: openCreateEditor }
    : undefined;

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">Trắc nghiệm</h2>
          <p className="text-sm text-muted-foreground">
            Danh sách đề thi, thời gian làm bài và trạng thái của bạn.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreateEditor}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            Tạo đề thi
          </Button>
        ) : null}
      </header>

      {course?.status === 'ARCHIVED' ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground" role="status">
          Khóa học đã lưu trữ; đề thi chỉ có thể xem.
        </p>
      ) : null}

      <DataState
        empty={{
          title: 'Chưa có đề thi',
          description: ownerView
            ? 'Tạo đề thi đầu tiên cho khóa học.'
            : 'Khóa học hiện chưa có đề thi được công bố.',
          action: emptyAction
        }}
        isEmpty={(result) => !result?.items?.length}
        loading={
          <div className="grid gap-2" role="status">
            <span className="sr-only">Đang tải danh sách đề thi...</span>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
        query={query}
      >
        {(result) => (
          <div className="grid gap-4">
            <ul className="divide-y rounded-lg border border-border">
              {result.items.map((quiz) => (
                <QuizRow
                  canManage={canManage}
                  key={quiz.id}
                  onEdit={openEditEditor}
                  onPublish={handlePublish}
                  ownerView={ownerView}
                  publishing={publishMutation.status === 'loading'}
                  quiz={quiz}
                />
              ))}
            </ul>
            {result.total > pageLimit ? (
              <Pagination
                disabled={query.status === 'loading'}
                onPageChange={setPage}
                page={page}
                totalPages={totalPages}
              />
            ) : null}
          </div>
        )}
      </DataState>

      <FormDialog
        description={editingQuiz
          ? 'Cập nhật cấu hình và câu hỏi của đề trước khi có lượt thi.'
          : 'Tạo đề nháp; có thể công bố sau khi đã thêm ít nhất một câu hỏi.'}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingQuiz(null);
            setDetailError(null);
          }
        }}
        open={editorOpen}
        title={editingQuiz ? 'Sửa đề thi' : 'Tạo đề thi'}
      >
        {detailLoading ? (
          <div className="grid gap-3" role="status">
            <span className="sr-only">Đang tải chi tiết đề thi...</span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detailError ? (
          <div className="grid gap-3">
            <p className="text-sm text-destructive" role="alert">{detailError.message}</p>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditorOpen(false);
                  setDetailError(null);
                }}
                variant="outline"
              >
                Đóng
              </Button>
            </div>
          </div>
        ) : editorOpen ? (
          <QuizEditorForm
            error={saveError}
            fieldErrors={saveError === saveMutation.error ? saveMutation.fieldErrors : {}}
            key={`${editingQuiz?.id ?? 'new'}-${editorRevision}`}
            onCancel={() => setEditorOpen(false)}
            onSubmit={save}
            pending={saveMutation.status === 'loading'}
            quiz={editingQuiz}
          />
        ) : null}
      </FormDialog>
    </section>
  );
}
