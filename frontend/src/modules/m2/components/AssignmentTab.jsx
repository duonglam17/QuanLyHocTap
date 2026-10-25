import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, FileSpreadsheet, Pencil, Plus } from 'lucide-react';
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
  Skeleton,
  StatusBadge,
  Textarea,
  toast
} from '../../../shared/components/index.js';
import {
  createAssignment,
  listCourseAssignments,
  updateAssignment
} from '../api/assignments.js';

const emptyForm = {
  title: '',
  description: '',
  due_date: '',
  max_score: '10',
  allow_late_submission: false
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
  const valueByType = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${valueByType.year}-${valueByType.month}-${valueByType.day}T${valueByType.hour}:${valueByType.minute}`;
}

function toApiDateTime(value) {
  return `${value}:00+07:00`;
}

function AssignmentForm({ assignment, pending, fieldErrors, error, onSubmit, resetKey }) {
  const [values, setValues] = useState(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setValues(
      assignment
        ? {
            title: assignment.title ?? '',
            description: assignment.description ?? '',
            due_date: toDateTimeLocal(assignment.due_date ?? assignment.deadline),
            max_score: String(assignment.max_score ?? 10),
            allow_late_submission: Boolean(assignment.allow_late_submission)
          }
        : emptyForm
    );
    setTouched(false);
  }, [assignment, resetKey]);

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setTouched(true);
    onSubmit({
      title: values.title.trim(),
      description: values.description,
      due_date: toApiDateTime(values.due_date),
      max_score: Number(values.max_score),
      allow_late_submission: values.allow_late_submission
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <FormField error={fieldErrors.title} id="assignment-title" label="Tiêu đề" required>
        <Input
          autoFocus
          disabled={pending}
          id="assignment-title"
          maxLength={200}
          onChange={(event) => updateField('title', event.target.value)}
          required
          value={values.title}
        />
      </FormField>
      <FormField error={fieldErrors.description} id="assignment-description" label="Mô tả">
        <Textarea
          disabled={pending}
          id="assignment-description"
          onChange={(event) => updateField('description', event.target.value)}
          value={values.description}
        />
      </FormField>
      <FormField
        error={fieldErrors.due_date}
        hint="Thời hạn được máy chủ xác nhận khi lưu."
        id="assignment-deadline"
        label="Hạn nộp"
        required
      >
        <DateTimeInput
          disabled={pending}
          id="assignment-deadline"
          onChange={(event) => updateField('due_date', event.target.value)}
          required
          value={values.due_date}
        />
      </FormField>
      <FormField error={fieldErrors.max_score} id="assignment-max-score" label="Điểm tối đa">
        <Input
          disabled={pending}
          id="assignment-max-score"
          max="10"
          min="0.01"
          onChange={(event) => updateField('max_score', event.target.value)}
          required
          step="0.01"
          type="number"
          value={values.max_score}
        />
      </FormField>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={values.allow_late_submission}
          disabled={pending}
          id="assignment-allow-late"
          onCheckedChange={(checked) => updateField('allow_late_submission', checked === true)}
        />
        <Label htmlFor="assignment-allow-late">
          Cho phép nộp trễ
        </Label>
        {fieldErrors.allow_late_submission ? (
          <span className="text-sm text-destructive" role="alert">
            {fieldErrors.allow_late_submission}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}
      {touched && !values.title.trim() ? (
        <p className="text-sm text-destructive" role="alert">
          Vui lòng nhập tiêu đề bài tập.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button disabled={pending} type="submit">
          {pending ? 'Đang lưu...' : assignment ? 'Lưu thay đổi' : 'Giao bài tập'}
        </Button>
      </div>
    </form>
  );
}

export function AssignmentTab({ courseId, course, role, isOwner = false }) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formRevision, setFormRevision] = useState(0);
  const [errorRevision, setErrorRevision] = useState(null);
  const assignmentsKey = ['m2', 'assignments', courseId, role];
  const query = useApiQuery(
    assignmentsKey,
    () => listCourseAssignments(courseId),
    { enabled: Boolean(courseId) }
  );
  const canManage =
    role === 'GIANG_VIEN' && isOwner && Boolean(course) && course.status !== 'ARCHIVED';
  const mutation = useApiMutation(
    (values) => (
      editingAssignment
        ? updateAssignment(editingAssignment.id, values)
        : createAssignment(courseId, values)
    ),
    {
      invalidate: [assignmentsKey],
      onSuccess: () => {
        toast.success(editingAssignment ? 'Đã cập nhật bài tập.' : 'Đã giao bài tập.');
        setDialogOpen(false);
        setEditingAssignment(null);
      }
    }
  );

  function openCreateForm() {
    setEditingAssignment(null);
    setFormRevision((revision) => revision + 1);
    setDialogOpen(true);
  }

  function openEditForm(assignment) {
    setEditingAssignment(assignment);
    setFormRevision((revision) => revision + 1);
    setDialogOpen(true);
  }

  async function saveAssignment(values) {
    setErrorRevision(formRevision);
    try {
      await mutation.mutate(values);
    } catch {
      // The mutation state displays the server error in the form.
    }
  }

  const emptyAction = canManage
    ? { label: 'Tạo bài tập đầu tiên', onClick: openCreateForm }
    : undefined;

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">Bài tập</h2>
          <p className="text-sm text-muted-foreground">
            Danh sách bài tập và hạn nộp của khóa học.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate(`/courses/${courseId}/grades`)} variant="outline">
              <FileSpreadsheet aria-hidden="true" className="mr-2 size-4" />
              Bảng điểm lớp
            </Button>
            <Button
              onClick={() => navigate(`/courses/${courseId}/assignments/grading`)}
              variant="outline"
            >
              <ClipboardCheck aria-hidden="true" className="mr-2 size-4" />
              Chấm bài
            </Button>
            <Button onClick={openCreateForm}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              Tạo bài tập
            </Button>
          </div>
        ) : null}
      </header>

      <DataState
        empty={{
          title: 'Chưa có bài tập',
          description: canManage
            ? 'Tạo bài tập đầu tiên để sinh viên bắt đầu làm bài.'
            : 'Giảng viên chưa giao bài tập cho khóa học này.',
          action: emptyAction
        }}
        isEmpty={(items) => !items?.length}
        query={query}
        loading={
          <div className="grid gap-2" role="status">
            <span className="sr-only">Đang tải danh sách bài tập...</span>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        }
      >
        {(items) => (
          <ul className="divide-y rounded-lg border border-border">
            {items.map((assignment) => (
              <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between" key={assignment.id}>
                <div className="grid min-w-0 gap-2">
                  <h3 className="font-medium">{assignment.title}</h3>
                  {assignment.description ? (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {assignment.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>Hạn nộp: {formatDateTime(assignment.due_date ?? assignment.deadline)}</span>
                    <span>Điểm tối đa: {assignment.max_score}</span>
                    <span>
                      {assignment.allow_late_submission ? 'Cho phép nộp trễ' : 'Không cho phép nộp trễ'}
                    </span>
                  </div>
                  {role === 'SINH_VIEN' ? (
                    <div>
                      <StatusBadge
                        type="submission"
                        value={assignment.submission_status ?? 'NOT_SUBMITTED'}
                      />
                    </div>
                  ) : null}
                </div>
                {canManage ? (
                  <Button
                    aria-label={`Sửa ${assignment.title}`}
                    onClick={() => openEditForm(assignment)}
                    size="sm"
                    variant="outline"
                  >
                    <Pencil aria-hidden="true" className="mr-2 size-4" />
                    Sửa
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DataState>

      <FormDialog
        description={editingAssignment ? 'Cập nhật thông tin bài tập.' : 'Nhập thông tin để giao bài tập cho khóa học.'}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={editingAssignment ? 'Sửa bài tập' : 'Tạo bài tập'}
      >
        <AssignmentForm
          assignment={editingAssignment}
          error={errorRevision === formRevision ? mutation.error : null}
          fieldErrors={errorRevision === formRevision ? mutation.fieldErrors : {}}
          onSubmit={saveAssignment}
          pending={mutation.status === 'loading'}
          resetKey={formRevision}
        />
      </FormDialog>
    </section>
  );
}

export default AssignmentTab;
