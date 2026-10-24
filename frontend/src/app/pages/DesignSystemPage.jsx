import { useState } from 'react';
import { Bell, BookOpen, Plus } from 'lucide-react';
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
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataState,
  DataTable,
  DateTimeInput,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  FileInput,
  Form,
  FormDialog,
  FormField,
  Input,
  Label,
  LoadingState,
  PageHeader,
  PageTemplate,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  StatusBadge,
  StatusMessage,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '../../shared/components/index.js';

function Section({ title, children }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function DesignSystemPage() {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [queryState, setQueryState] = useState('loading');

  return (
    <PageTemplate
      title="Design system"
      description="Thư viện component dùng chung và các trạng thái tải dữ liệu. Chỉ hiển thị trong môi trường phát triển."
    >
      <PageHeader
        actions={<Button><Plus className="mr-2 size-4" />Hành động chính</Button>}
        description="Nội dung và ví dụ đều dùng token ngữ nghĩa."
        title="Mẫu giao diện"
      />

      <Section title="Atoms: nút, trường nhập, nhãn và biểu mẫu">
        <div className="flex flex-wrap gap-2">
          <Button>Chính</Button>
          <Button variant="secondary">Phụ</Button>
          <Button variant="outline">Viền</Button>
          <Button variant="ghost">Tối giản</Button>
          <Button variant="destructive">Nguy hiểm</Button>
          <Button disabled><Spinner className="mr-2" />Đang lưu</Button>
        </div>
        <Form className="grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <FormField id="demo-title" label="Tiêu đề" required>
            <Input id="demo-title" placeholder="Nhập tiêu đề" />
          </FormField>
          <FormField id="demo-date" label="Ngày giờ">
            <DateTimeInput id="demo-date" />
          </FormField>
          <FormField id="demo-description" label="Mô tả">
            <Textarea id="demo-description" placeholder="Nhập mô tả" />
          </FormField>
          <div className="grid content-start gap-3">
            <Label htmlFor="demo-check">Tùy chọn</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} id="demo-check" onCheckedChange={setChecked} />
              Cho phép nộp trễ
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              Bật thông báo
            </label>
          </div>
        </Form>
        <div className="flex flex-wrap items-center gap-3">
          <Select defaultValue="student">
            <SelectTrigger className="w-48"><SelectValue placeholder="Chọn vai trò" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Sinh viên</SelectItem>
              <SelectItem value="instructor">Giảng viên</SelectItem>
            </SelectContent>
          </Select>
          <Avatar>
            <AvatarImage alt="Ảnh hồ sơ" src="/avatar-not-found.png" />
            <AvatarFallback>SV</AvatarFallback>
          </Avatar>
          <Badge>Đang hoạt động</Badge>
          <Badge variant="secondary">Bản nháp</Badge>
          <Badge variant="success">Đã nộp</Badge>
          <Badge variant="warning">Sắp đến hạn</Badge>
          <Badge variant="destructive">Lỗi</Badge>
          <Badge variant="outline">Thông tin</Badge>
          <Skeleton className="h-8 w-24" />
        </div>
      </Section>

      <Section title="Atoms: điều hướng, menu và bảng">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild><Button variant="outline"><Bell className="mr-2 size-4" />Tooltip</Button></TooltipTrigger>
            <TooltipContent>Tiện ích dùng chung</TooltipContent>
          </Tooltip>
          <Dialog>
            <DialogTrigger asChild><Button variant="outline">Dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hộp thoại</DialogTitle>
                <DialogDescription>Ví dụ dialog cho các thao tác cần thêm nội dung.</DialogDescription>
              </DialogHeader>
              <p className="text-sm">Nội dung hộp thoại.</p>
              <DialogFooter><DialogClose asChild><Button variant="outline">Đóng</Button></DialogClose></DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline">Alert dialog</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xác nhận thao tác</AlertDialogTitle>
                <AlertDialogDescription>Ví dụ hộp thoại xác nhận.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-10 rounded-md border border-input px-4">Hủy</AlertDialogCancel>
                <AlertDialogAction className="h-10 rounded-md bg-primary px-4 text-primary-foreground">Tiếp tục</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline">Dropdown menu</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Tùy chọn</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Mở</DropdownMenuItem>
              <DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>Hiện thông tin</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger>
            <PopoverContent><p className="text-sm">Nội dung popover.</p></PopoverContent>
          </Popover>
          <Button onClick={() => toast.success('Đã lưu thành công')}>Toast thành công</Button>
          <Button onClick={() => toast.error('Không thể hoàn tất thao tác')} variant="destructive">Toast lỗi</Button>
        </div>
        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments">Bài tập</TabsTrigger>
            <TabsTrigger value="grades">Điểm</TabsTrigger>
          </TabsList>
          <TabsContent value="assignments">Nội dung tab bài tập.</TabsContent>
          <TabsContent value="grades">Nội dung tab điểm.</TabsContent>
        </Tabs>
        <Table>
          <TableHeader><TableRow><TableHead>Mã</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell>BT-01</TableCell><TableCell><StatusBadge type="submission" value="SUBMITTED" /></TableCell></TableRow></TableBody>
        </Table>
        <ConfirmDialog
          description="Ví dụ xác nhận đóng bài tập."
          trigger={<Button variant="outline">Confirm dialog</Button>}
          title="Đóng bài tập?"
        />
      </Section>

      <Section title="Molecules và organisms">
        <PageHeader description="Tiêu đề có phần mô tả và vùng hành động." title="Danh sách bài tập" />
        <SearchInput
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          value={search}
        />
        <FileInput accept=".pdf,.docx,.zip" maxSize={20 * 1024 * 1024} />
        <div className="grid gap-3 md:grid-cols-2">
          <StatusMessage title="Thông báo trạng thái">Nội dung trạng thái trung tính.</StatusMessage>
          <EmptyState
            action={<Button variant="outline">Tạo dữ liệu</Button>}
            description="Tạo mục đầu tiên để bắt đầu."
            title="Chưa có bài tập"
          />
          <ErrorState message="Không thể tải danh sách." onRetry={() => toast.message('Đang thử lại')} />
          <div className="grid gap-2">
            <StatusBadge type="course" value="ARCHIVED" />
            <StatusBadge type="attempt" value="IN_PROGRESS" />
            <StatusBadge type="schedule" value="RESCHEDULED" />
            <StatusBadge type="quiz" value="PUBLISHED" />
          </div>
          <LoadingState message="Đang tải danh sách minh họa..." />
        </div>
        <DataTable
          columns={[
            { key: 'title', header: 'Bài tập' },
            { key: 'state', header: 'Trạng thái', cell: (row) => <StatusBadge type="submission" value={row.state} /> }
          ]}
          onPageChange={setCurrentPage}
          page={currentPage}
          rows={[{ id: 1, title: 'Bài tập thiết kế API', state: 'SUBMITTED_LATE' }]}
          totalPages={3}
        />
        <Pagination page={currentPage} totalPages={3} onPageChange={setCurrentPage} />
        <FormDialog
          description="Ví dụ form dialog."
          title="Tạo bài tập"
          trigger={<Button variant="outline">Form dialog</Button>}
        >
          <Input aria-label="Tên bài tập" placeholder="Tên bài tập" />
        </FormDialog>
      </Section>

      <Section title="DataState: Loading, Error, Empty và Success">
        <div className="flex flex-wrap gap-2">
          {['loading', 'error', 'empty', 'success'].map((state) => (
            <Button
              key={state}
              onClick={() => setQueryState(state)}
              variant={queryState === state ? 'default' : 'outline'}
            >
              {state}
            </Button>
          ))}
        </div>
        <DataState
          empty={{ title: 'Chưa có dữ liệu', description: 'Chưa có bản ghi nào.' }}
          isEmpty={(data) => data.length === 0}
          loading={<div className="grid gap-2"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-16 w-full" /></div>}
          query={{
            status: queryState === 'loading' ? 'loading' : queryState === 'error' ? 'error' : 'success',
            data: queryState === 'empty' ? [] : [{ title: 'Bản ghi mẫu' }],
            error: new Error('Máy chủ chưa phản hồi.'),
            refetch: () => setQueryState('success')
          }}
        >
          {(data) => <StatusMessage title="Đã tải dữ liệu">{data[0].title}</StatusMessage>}
        </DataState>
      </Section>

      <Section title="Các thành phần hỗ trợ khác">
        <div className="flex flex-wrap items-center gap-3">
          <BookOpen aria-label="Biểu tượng BookOpen" className="size-5 text-primary" />
          <p className="text-sm text-muted-foreground">lucide-react icons, formatters, cn và test utilities dùng qua shared.</p>
          <Button onClick={() => toast.message('Mẫu thông báo')} variant="secondary">Thông báo</Button>
        </div>
      </Section>
    </PageTemplate>
  );
}
