# TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD) - HỆ THỐNG QUẢN LÝ HỌC TẬP (LMS MINI)

---

## 1. Tổng quan và Mục tiêu dự án

### 1.1. Bối cảnh
Trong môi trường giáo dục đại học, nhu cầu quản lý việc dạy và học theo từng học phần đòi hỏi một hệ thống đơn giản, trực quan, hỗ trợ giảng viên dễ dàng tổ chức bài giảng, giao bài tập, tổ chức thi trắc nghiệm và theo dõi tiến độ của sinh viên. Dự án **LMS Mini** được định hình là giải pháp web app tinh gọn, tập trung giải quyết trọn vẹn các luồng nghiệp vụ cốt lõi của việc dạy và học trực tuyến.

### 1.2. Mục tiêu sản phẩm (SMART)
- **Mục tiêu 1:** Cung cấp đầy đủ nền tảng để hoàn thành 3 luồng công việc cốt lõi của một học phần:
  1. Giảng viên tạo khóa học, chia sẻ tài liệu; sinh viên ghi danh và học tập.
  2. Giảng viên giao bài tập tự luận có hạn nộp; sinh viên nộp bài đính kèm tệp; giảng viên chấm điểm và trả nhận xét.
  3. Giảng viên tạo đề thi trắc nghiệm; sinh viên làm bài thi trực tuyến với đồng hồ đếm ngược; hệ thống tự động chấm điểm và lưu kết quả ngay sau khi nộp bài.
- **Mục tiêu 2 (Khả năng chịu tải MVP):** Hỗ trợ lớp học quy mô 50–100 sinh viên tham gia đồng thời làm bài thi trắc nghiệm và nộp bài tập mà không xảy ra xung đột dữ liệu hoặc treo hệ thống.
- **Mục tiêu 3 (Thời hạn & Nguồn lực):** Xây dựng hoàn chỉnh phiên bản MVP trong 1-2 tháng bởi nhóm phát triển gồm 3 thành viên, tối ưu hóa phạm vi để đảm bảo chất lượng, tính toàn vẹn dữ liệu và an toàn bảo mật.

---

## 2. Chân dung Người dùng (Personas)

| Tiêu chí | Persona 1: Admin (Quản trị viên) | Persona 2: Giảng viên (Instructor) | Persona 3: Sinh viên (Student) |
|---|---|---|---|
| **Đại diện** | Anh Hoàng (35 tuổi) - Quản trị hệ thống | Cô Mai (42 tuổi) - Giảng viên Công nghệ thông tin | Bạn Nam (20 tuổi) - Sinh viên năm 2 |
| **Mục tiêu** | Đảm bảo hệ thống vận hành an toàn, cấp phát tài khoản đúng vai trò, quản lý trạng thái tài khoản. | Tạo không gian học tập khoa học, kiểm soát bài tập và tiến độ nộp bài của sinh viên, giảm tải thời gian chấm thi trắc nghiệm. | Nắm bắt thời hạn nộp bài, tải tài liệu bài giảng nhanh chóng, thi trắc nghiệm minh bạch và biết điểm ngay. |
| **Nỗi đau (Pain points)** | Quản trị thủ công qua database dễ sai sót; lo ngại tài khoản bị lộ lọt hoặc spam tài khoản rác. | Tốn nhiều thời gian chấm bài thủ công; khó kiểm soát sinh viên nộp bài trễ hạn qua email; tệp nộp bài bị thất lạc. | Quên hạn nộp bài tập; lo lắng bị mất bài làm do mạng chập chờn khi đang thi trắc nghiệm; không biết bài nộp đã ghi nhận thành công hay chưa. |

---

## 3. Danh mục Epic và Mức độ Ưu tiên (MoSCoW)

| Mã Epic | Tên Epic | Mô tả tóm tắt | Mức độ ưu tiên |
|---|---|---|---|
| **E1** | Quản lý Tài khoản & Xác thực | Đăng nhập, phân quyền 3 vai trò (Admin, Giảng viên, Sinh viên), khóa/mở tài khoản. | **Must** |
| **E2** | Quản lý Khóa học, Bài giảng & Lịch học | Tạo khóa học, sinh viên tham gia bằng mã khóa học (Enrollment Key), đăng tải và tải tài liệu học tập, quản lý thời khóa biểu/lịch học. | **Must** (US-03..06) / **Should** (US-17, 18) |
| **E3** | Quản lý Bài tập & Chấm bài Tự luận | Tạo bài tập có hạn nộp (deadline), sinh viên nộp bài đính kèm tệp, giảng viên chấm điểm (thang điểm 10) và phản hồi. | **Must** |
| **E4** | Thi Trắc nghiệm & Chấm tự động | Ngân hàng câu hỏi, tạo đề thi giới hạn thời gian, sinh viên làm bài, hệ thống tự động chấm điểm và công bố kết quả. | **Must** |
| **E5** | Bảng điểm & Thống kê cá nhân | Sinh viên xem bảng điểm cá nhân; Giảng viên xem và xuất bảng điểm tổng hợp khóa học. | **Must** (US-13) / **Should** (US-14) |
| **E6** | Thông báo & Thảo luận lớp học | Bảng tin thông báo chung của khóa học; Diễn đàn trao đổi thảo luận giữa giảng viên và sinh viên. | **Should** |

---

## 4. Chi tiết Yêu cầu Chức năng & User Stories (Gherkin Scenarios)

### Epic E1: Quản lý Tài khoản & Xác thực

#### US-01: Đăng nhập hệ thống
> **As an** Người dùng (Admin, Giảng viên, Sinh viên),  
> **I want to** đăng nhập vào hệ thống bằng tên đăng nhập (hoặc email) và mật khẩu,  
> **So that** tôi truy cập đúng các tính năng tương ứng với quyền hạn của mình.

*Quy tắc nghiệp vụ liên quan: BR-01, BR-02*

```gherkin
Feature: Dang nhap he thong

  Background:
    Given He thong dang hoat dong binh thuong
    And Tai khoan "gv_mai" co vai tro "GIANG_VIEN", mat khau "MatKhau@123", trang thai "ACTIVE"
    And Tai khoan "sv_nam" co vai tro "SINH_VIEN", mat khau "MatKhau@123", trang thai "ACTIVE"
    And Tai khoan "sv_khoa" co trang thai "LOCKED"

  Scenario: Dang nhap thanh cong voi thong tin chinh xac
    Given Nguoi dung dang o man hinh dang nhap
    When Nguoi dung nhap ten dang nhap "gv_mai" va mat khau "MatKhau@123"
    And Nguoi dung nhan nut "Dang nhap"
    Then He thong xac thuc thanh cong
    And He thong tao phien dang nhap hop le
    And He thong chuyen huong nguoi dung toi man hinh "Dashboard Giang Vien"

  Scenario Outline: Dang nhap that bai do sai thong tin
    Given Nguoi dung dang o man hinh dang nhap
    When Nguoi dung nhap ten dang nhap "<username>" va mat khau "<password>"
    And Nguoi dung nhan nut "Dang nhap"
    Then He thong tu choi dang nhap
    And He thong hien thi thong bao loi "<error_message>"
    And Nguoi dung van o lai man hinh dang nhap

    Examples:
      | username | password     | error_message                            |
      | gv_mai   | SaiMatKhau   | Ten dang nhap hoac mat khau khong dung   |
      | khong_co | MatKhau@123  | Ten dang nhap hoac mat khau khong dung   |
      |          | MatKhau@123  | Vui long nhap day du thong tin dang nhap |
      | gv_mai   |              | Vui long nhap day du thong tin dang nhap |

  Scenario: Khoa tam thoi tai khoan khi nhap sai qua 5 lan lien tiep (Chong Brute Force)
    Given Nguoi dung dang o man hinh dang nhap
    And Tai khoan "sv_nam" da nhap sai mat khau 4 lan lien tiep truoc do
    When Nguoi dung nhap ten dang nhap "sv_nam" va mat khau "SaiMatKhauLan5"
    And Nguoi dung nhan nut "Dang nhap"
    Then He thong tu choi dang nhap
    And He thong cap nhat trang thai tai khoan "sv_nam" thanh "TEMPORARY_LOCKED" trong 15 phut
    And He thong hien thi thong bao "Tai khoan bi tam khoa 15 phut do nhap sai qua 5 lan"

  Scenario: Dang nhap bang tai khoan dang bi khoa
    Given Nguoi dung dang o man hinh dang nhap
    When Nguoi dung nhap ten dang nhap "sv_khoa" va mat khau "MatKhau@123"
    And Nguoi dung nhan nut "Dang nhap"
    Then He thong tu choi dang nhap
    And He thong hien thi thong bao "Tai khoan cua ban da bi khoa. Vui long lien he Admin"
```

---

#### US-02: Quản lý người dùng bởi Admin
> **As an** Quản trị viên (Admin),  
> **I want to** tạo tài khoản, chỉ định vai trò và thay đổi trạng thái kích hoạt của người dùng,  
> **So that** tôi kiểm soát danh tính và quyền truy cập vào hệ thống.

*Quy tắc nghiệp vụ liên quan: BR-01*

```gherkin
Feature: Quan ly nguoi dung boi Admin

  Background:
    Given Admin da dang nhap thanh cong vao he thong
    And Dang o man hinh "Quan ly nguoi dung"

  Scenario: Admin tao moi tai khoan giang vien thanh cong
    When Admin nhan nut "Tao tai khoan"
    And Admin nhap ho ten "Nguyen Van A", email "anv@lms.edu.vn", ten dang nhap "gv_anv", vai tro "GIANG_VIEN"
    And Admin nhan nut "Luu"
    Then He thong tao moi tai khoan voi trang thai mac dinh "ACTIVE"
    And He thong sinh mat khau ngau nhien mac dinh
    And He thong hien thi thong bao "Tao tai khoan thanh cong"
    And Danh sach nguoi dung xuat hien tai khoan "gv_anv"

  Scenario: Admin tao tai khoan trung ten dang nhap hoac email da ton tai
    Given He thong da co tai khoan voi email "mai@lms.edu.vn" va username "gv_mai"
    When Admin nhan nut "Tao tai khoan"
    And Admin nhap email "mai@lms.edu.vn" hoac ten dang nhap "gv_mai"
    And Admin nhan nut "Luu"
    Then He thong tu choi luu du lieu
    And He thong hien thi thong bao loi "Ten dang nhap hoac email da duoc su dung"

  Scenario: Admin khoa tai khoan nguoi dung dang vi pham
    Given Trong danh sach nguoi dung co tai khoan "sv_quayroi" trang thai "ACTIVE"
    When Admin chon thao tac "Khoa tai khoan" cho "sv_quayroi"
    And Admin xac nhan hanh dong
    Then He thong cap nhat trang thai tai khoan "sv_quayroi" sang "LOCKED"
    And Moi phien dang nhap hien tai cua "sv_quayroi" bi vo hieu hoa ngay lap tuc
```

---

### Epic E2: Quản lý Khóa học & Bài giảng

#### US-03: Giảng viên tạo và quản lý khóa học
> **As a** Giảng viên,  
> **I want to** tạo khóa học mới, thiết lập thông tin và sinh Mã tham gia (Enrollment Key),  
> **So that** tôi chuẩn bị không gian học tập cho sinh viên của lớp mình.

*Quy tắc nghiệp vụ liên quan: BR-03, BR-04*

```gherkin
Feature: Tao va quan ly khoa hoc

  Background:
    Given Giang vien "gv_mai" da dang nhap thanh cong
    And Dang o trang "Danh sach khoa hoc cua toi"

  Scenario: Tao khoa hoc moi thanh cong
    When Giang vien nhan nut "Tao khoa hoc moi"
    And Giang vien nhap ma mon "INT3101", ten khoa hoc "Lap trinh Web nang cao", hoc ky "HK1-2026"
    And Giang vien chon bat tinh nang "Yeu cau ma ghi danh"
    And Giang vien nhan nut "Xac nhan tao"
    Then He thong tao moi khoa hoc voi trang thai "DRAFT"
    And He thong tu dong sinh mot ma ghi danh ngau nhien duy nhat gom 6 ky tu in hoa va so
    And Giang vien duoc ghi nhan la "Chu so huu khoa hoc" (Owner)
    And He thong hien thi thong bao "Tao khoa hoc thanh cong"

  Scenario: Tao khoa hoc that bai do thieu thong tin bat buoc
    When Giang vien nhan nut "Tao khoa hoc moi"
    And Giang vien de trong truong "Ten khoa hoc"
    And Giang vien nhan nut "Xac nhan tao"
    Then He thong tu choi luu
    And He thong hien thi canh bao "Ten khoa hoc khong duoc de trong"

  Scenario: Giang vien xuat ban (Publish) khoa hoc de mo ghi danh
    Given Khoa hoc "Lap trinh Web" cua giang vien "gv_mai" dang o trang thai "DRAFT"
    When Giang vien nhan nut "Xuat ban khoa hoc"
    Then Trang thai khoa hoc chuyen thanh "PUBLISHED"
    And Sinh vien co the tim kiem va ghi danh vao khoa hoc nay
```

---

#### US-04: Sinh viên ghi danh vào khóa học bằng Mã ghi danh
> **As a** Sinh viên,  
> **I want to** nhập mã khóa học để ghi danh tham gia lớp học,  
> **So that** tôi có thể truy cập nội dung bài học, nộp bài tập và tham gia kiểm tra.

*Quy tắc nghiệp vụ liên quan: BR-04, BR-05*

```gherkin
Feature: Ghi danh khoa hoc bang ma

  Background:
    Given Sinh vien "sv_nam" da dang nhap thanh cong
    And Khoa hoc "CS101" co trang thai "PUBLISHED" va ma ghi danh la "WEB2026"

  Scenario: Ghi danh thanh cong voi ma chinh xac
    Given Sinh vien o trang "Tham gia khoa hoc"
    When Sinh vien nhap ma ghi danh "WEB2026"
    And Sinh vien nhan nut "Tham gia"
    Then He thong ghi nhan sinh vien "sv_nam" la thanh vien cua khoa hoc "CS101"
    And He thong hien thi thong bao "Ghi danh khoa hoc thanh cong"
    And Khoa hoc "CS101" xuat hien trong danh sach "Khoa hoc cua toi" cua sinh vien

  Scenario Outline: Ghi danh that bai do ma khong hop le hoac sai ma
    Given Sinh vien o trang "Tham gia khoa hoc"
    When Sinh vien nhap ma ghi danh "<enrollment_key>"
    And Sinh vien nhan nut "Tham gia"
    Then He thong tu choi ghi danh
    And He thong hien thi thong bao loi "<error_message>"

    Examples:
      | enrollment_key | error_message                                |
      | SAI999         | Ma ghi danh khong ton tai hoac chua xuat ban |
      |                | Vui long nhap ma ghi danh                    |

  Scenario: Sinh vien co tinh ghi danh lai vao khoa hoc da tham gia
    Given Sinh vien "sv_nam" da la thanh vien cua khoa hoc "CS101"
    When Sinh vien nhap ma ghi danh "WEB2026" va bam "Tham gia"
    Then He thong canh bao "Ban da la thanh vien cua khoa hoc nay"
    And He thong chuyen thang vao giao dien chinh cua khoa hoc "CS101"
```

---

#### US-05: Giảng viên đăng tải bài giảng và tài liệu học tập
> **As a** Giảng viên,  
> **I want to** tạo bài học mới và tải lên tệp tài liệu (PDF, slide),  
> **So that** sinh viên có tài liệu nghiên cứu và học tập.

*Quy tắc nghiệp vụ liên quan: BR-06, BR-10*

```gherkin
Feature: Dang tai bai giang va tai lieu

  Background:
    Given Giang vien "gv_mai" dang quan ly khoa hoc "CS101" do minh so huu
    And Giang vien o man hinh "Noi dung khoa hoc"

  Scenario: Dang tai tai lieu hop le thanh cong
    When Giang vien nhan nut "Them tai lieu moi"
    And Giang vien nhap tieu de "Chuong 1: Tong quan Kien truc Web"
    And Giang vien dinh kem tep "slides_chuong1.pdf" co dung luong 5MB
    And Giang vien nhan nut "Dang tai"
    Then He thong luu tru tep vao thu muc an toan va sinh ten tep duy nhat (UUID)
    And He thong luu ban ghi tai lieu vao he thong
    And Danh sach bai hoc hien thi "Chuong 1: Tong quan Kien truc Web"
    And He thong hien thi thong bao "Dang tai lieu thanh cong"

  Scenario: Tu choi dang tai tep vuot qua dung luong cho phep
    When Giang vien nhan nut "Them tai lieu moi"
    And Giang vien dinh kem tep "video_bai_giang.mp4" co dung luong 120MB (gioi han toi da la 50MB)
    And Giang vien nhan nut "Dang tai"
    Then He thong tu choi tiep nhan tep
    And He thong thong bao loi "Dung luong tep vuot qua gioi han toi da 50MB"

  Scenario: Ngan chan upload tep tin chua ma doc hoac duoi thuc thi
    When Giang vien nhan nut "Them tai lieu moi"
    And Giang vien dinh kem tep "tai_lieu.exe" hoac "script.sh"
    And Giang vien nhan nut "Dang tai"
    Then He thong kiem tra extension va MIME type
    And He thong tu choi tep va canh bao "Loai dinh dang tep khong duoc ho tro. Chi chap nhan PDF, DOCX, PPTX, ZIP"
```

---

#### US-06: Sinh viên xem và tải tài liệu bài giảng
> **As a** Sinh viên,  
> **I want to** xem danh sách các bài học và tải tài liệu đính kèm về máy,  
> **So that** tôi ôn tập kiến thức môn học.

*Quy tắc nghiệp vụ liên quan: BR-05, BR-11*

```gherkin
Feature: Xem va tai tai lieu bai giang

  Background:
    Given Khoa hoc "CS101" co bai giang "Chuong 1" voi tep dinh kem "slides_chuong1.pdf"

  Scenario: Sinh vien da tham gia khoa hoc tai tai lieu thanh cong
    Given Sinh vien "sv_nam" da ghi danh vao khoa hoc "CS101"
    When Sinh vien truy cap vao bai hoc "Chuong 1"
    And Sinh vien bam vao duong dan tai tep "slides_chuong1.pdf"
    Then He thong tao duong dan tai an toan co kiem tra quyen truy cap
    And Trinh duyet tai tep tin ve may cua sinh vien voi ten goc "slides_chuong1.pdf"

  Scenario: Sinh vien chua ghi danh co tinh tai tai lieu qua URL truc tiep (Chong IDOR)
    Given Sinh vien "sv_la" chua tung ghi danh vao khoa hoc "CS101"
    When Sinh vien "sv_la" co tinh truy cap duong dan download file truc tiep "/api/courses/CS101/materials/123/download"
    Then He thong kiem tra quyen thanh vien
    And He thong tra ve ma loi HTTP 403 Forbidden
    And He thong hien thi thong bao "Ban khong co quyen truy cap tai lieu nay"
```

---

#### US-17: Giảng viên thiết lập và quản lý lịch học (Should)
> **As a** Giảng viên,  
> **I want to** tạo và quản lý lịch học (ngày học, giờ bắt đầu, giờ kết thúc, phòng học hoặc đường dẫn học trực tuyến, chủ đề buổi học),  
> **So that** sinh viên trong lớp nắm được thời gian và địa điểm học tập cụ thể.

*Quy tắc nghiệp vụ liên quan: BR-03, BR-19*

```gherkin
Feature: Thiet lap va quan ly lich hoc

  Background:
    Given Giang vien "gv_mai" dang quan ly khoa hoc "CS101"
    And Giang vien o man hinh "Quan ly lich hoc"

  Scenario: Tao buoi hoc moi thanh cong
    When Giang vien nhan nut "Them buoi hoc"
    And Giang vien nhap tieu de "Buoi 1: Gioi thieu mon hoc va moi truong lap trinh"
    And Giang vien chon ngay hoc la "2026-11-10"
    And Giang vien chon gio bat dau "08:00" va gio ket thuc "11:30"
    And Giang vien nhap phong hoc "Phong may B302"
    And Giang vien nhan nut "Luu lich hoc"
    Then He thong luu thong tin buoi hoc vao khoa hoc "CS101"
    And He thong hien thi thong bao "Tao lich hoc thanh cong"
    And Buoi hoc xuat hien trong danh sach lich hoc cua lop

  Scenario Outline: Tao buoi hoc that bai do thoi gian khong hop le
    When Giang vien nhan nut "Them buoi hoc"
    And Giang vien nhap gio bat dau "<start_time>" va gio ket thuc "<end_time>"
    And Giang vien nhan nut "Luu lich hoc"
    Then He thong tu choi luu lich hoc
    And He thong hien thi thong bao loi "<error_message>"

    Examples:
      | start_time | end_time | error_message                                      |
      | 10:00      | 09:00    | Gio ket thuc phai sau gio bat dau                  |
      | 08:00      | 08:00    | Gio ket thuc phai sau gio bat dau                  |
      |            | 11:00    | Vui long nhap day du gio bat dau va gio ket thuc   |

  Scenario: Canh bao khi tao buoi hoc trung gio voi buoi hoc da co trong cung khoa hoc
    Given Khoa hoc "CS101" da co buoi hoc vao ngay "2026-11-10" tu "08:00" den "11:30"
    When Giang vien tao them buoi hoc khac cung vao ngay "2026-11-10" tu "09:00" den "12:00"
    And Giang vien nhan nut "Luu lich hoc"
    Then He thong kiem tra xung dot thoi gian
    And He thong tu choi luu va thong bao loi "Khung gio bi trung voi buoi hoc da ton tai tren he thong"
```

---

#### US-18: Sinh viên xem thời khóa biểu và lịch học (Should)
> **As a** Sinh viên,  
> **I want to** xem danh sách các buổi học và thời khóa biểu của các khóa học mà mình tham gia,  
> **So that** tôi chủ động sắp xếp thời gian đi học đúng giờ.

*Quy tắc nghiệp vụ liên quan: BR-05, BR-20*

```gherkin
Feature: Xem thoi khoa bieu va lich hoc

  Background:
    Given Sinh vien "sv_nam" da ghi danh vao khoa hoc "CS101"
    And Khoa hoc "CS101" co lich hoc ngay "2026-11-10" tu "08:00" den "11:30" tai "Phong may B302"

  Scenario: Sinh vien xem lich hoc cua khoa hoc thanh cong
    When Sinh vien truy cap vao muc "Lich hoc" trong khoa hoc "CS101"
    Then He thong hien thi danh sach cac buoi hoc sap dien ra
    And Thong tin hien thi day du: Ngay hoc, Khung gio, Phong hoc/Link hoc, Chu de buoi hoc
    And Buoi hoc sap toi nhat duoc lam noi bat tren giao dien

  Scenario: Sinh vien chua ghi danh co tinh xem lich hoc chi tiet (Chong IDOR)
    Given Sinh vien "sv_la" chua tung ghi danh vao khoa hoc "CS101"
    When Sinh vien "sv_la" gui request GET "/api/courses/CS101/schedules"
    Then He thong kiem tra quyen thanh vien
    And He thong tra ve ma loi HTTP 403 Forbidden
    And He thong hien thi thong bao "Ban can ghi danh khoa hoc de xem thoi khoa bieu chi tiet"
```

---

### Epic E3: Quản lý Bài tập & Chấm bài Tự luận

#### US-07: Giảng viên tạo và giao bài tập tự luận
> **As a** Giảng viên,  
> **I want to** tạo bài tập với tiêu đề, hướng dẫn làm bài, hạn nộp (deadline) và định dạng nộp cho phép,  
> **So that** sinh viên thực hành và nộp bài để tôi đánh giá kết quả.

*Quy tắc nghiệp vụ liên quan: BR-07, BR-08*

```gherkin
Feature: Tao va giao bai tap tu luan

  Background:
    Given Giang vien "gv_mai" dang o trang quan ly khoa hoc "CS101"

  Scenario: Tao bai tap tu luan thanh cong voi han nop hop le
    When Giang vien nhan nut "Giao bai tap moi"
    And Giang vien nhap tieu de "Bai tap lon 1: Thiet ke Database"
    And Giang vien nhap yeu cau "Nop file PDF va ma nguon file ZIP"
    And Giang vien chon han nop la "2026-11-30 23:59:59" (thoi diem trong tuong lai)
    And Giang vien dat diem toi da la 10
    And Giang vien cho phep nop muon nhung ghi chu "Late"
    And Giang vien nhan nut "Phat hanh bai tap"
    Then He thong luu bai tap o trang thai "OPEN"
    And Sinh vien trong khoa hoc nhan duoc thong bao co bai tap moi

  Scenario: Tao bai tap that bai do chon han nop trong qua khu
    When Giang vien nhan nut "Giao bai tap moi"
    And Giang vien chon han nop la mot thoi diem trong qua khu so voi thoi gian server hien tai
    And Giang vien nhan nut "Phat hanh bai tap"
    Then He thong tu choi luu bai tap
    And He thong thong bao loi "Han nop phai la mot thoi diem trong tuong lai"
```

---

#### US-08: Sinh viên nộp bài tập tự luận
> **As a** Sinh viên,  
> **I want to** tải tệp bài làm lên và xác nhận nộp trước hạn chót,  
> **So that** giảng viên chấm điểm cho tôi.

*Quy tắc nghiệp vụ liên quan: BR-07, BR-08, BR-10*

```gherkin
Feature: Nop bai tap tu luan

  Background:
    Given Sinh vien "sv_nam" da ghi danh vao khoa hoc "CS101"
    And Bai tap "BT-01" co han nop la "2026-11-20 23:59:59" gio server
    And Sinh vien dang o trang chi tiet bai tap "BT-01"

  Scenario: Nop bai tap lan dau dung han thanh cong
    Given Thoi gian server hien tai la "2026-11-19 14:00:00" (truoc han nop)
    When Sinh vien dinh kem tep "BaoCao_Nam.pdf" (kich thuoc 3MB)
    And Sinh vien nhan nut "Nop bai"
    Then He thong luu tep nop an toan
    And He thong ghi nhan trang thai bai nop la "SUBMITTED"
    And Thoi gian nop duoc ghi nhan theo dong ho cua server
    And He thong hien thi thong bao "Nop bai tap thanh cong"

  Scenario: Nop bai sau han chót (Late submission)
    Given Thoi gian server hien tai la "2026-11-21 08:00:00" (qua han nop 8 gio)
    And Bai tap co cau hinh "Cho phep nop muon"
    When Sinh vien dinh kem tep "BaoCaoMuon.pdf" va bam "Nop bai"
    Then He thong tiep nhan bai nop
    And He thong ghi nhan trang thai bai nop la "SUBMITTED_LATE"
    And He thong danh dau nhan "Nop tre 8 gio 00 phut"
    And He thong hien thi thong bao "Da nop bai (Ghi nhan nop tre)"

  Scenario: Ngan chan double submit khi click nut nop nhieu lan lien tiep
    Given Sinh vien da chon tep "BaiLam.zip"
    When Sinh vien bam nut "Nop bai" lien tiep 3 lan trong vong 1 giay do mang cham
    Then He thong vo hieu hoa nut bam ngay sau lan nhan dau tien (disable button & debounce)
    And He thong chi xu ly dung 1 transaction luu bai nop
    And Khong tao ra ban ghi trung lap trong co so du lieu

  Scenario: Nop lai bai tap truoc khi het han nop
    Given Sinh vien "sv_nam" da tung nop tep "BaiLam_v1.pdf"
    And Thoi gian server van con truoc deadline
    When Sinh vien tai len tep moi "BaiLam_v2.pdf" va chon "Cap nhat bai nop"
    Then He thong ghi de hoac tao phien ban nop moi nhat "BaiLam_v2.pdf"
    And He thong cap nhat thoi gian nop moi nhat
    And He thong xoa hoac luu tru tep cu dung quy dinh
```

---

#### US-09: Giảng viên chấm điểm và phản hồi bài tập
> **As a** Giảng viên,  
> **I want to** tải bài làm của từng sinh viên, nhập điểm số (0–10) và lời nhận xét,  
> **So that** sinh viên biết kết quả và rút kinh nghiệm học tập.

*Quy tắc nghiệp vụ liên quan: BR-08, BR-09, BR-11*

```gherkin
Feature: Cham diem va phan hoi bai tap

  Background:
    Given Giang vien "gv_mai" la chu so huu khoa hoc "CS101"
    And Sinh vien "sv_nam" da nop bai tap "BT-01" co trang thai "SUBMITTED"
    And Giang vien dang o giao dien cham bai cua sinh vien "sv_nam"

  Scenario: Cham diem hop le thanh cong
    When Giang vien nhap diem "8.5" vao o diem so
    And Giang vien nhap nhan xet "Bao cao trinh bay tot, can bo sung them phan ket luan"
    And Giang vien nhan nut "Luu diem"
    Then He thong ghi nhan diem "8.5" va nhan xet vao ban ghi bai nop
    And Trang thai bai nop chuyen sang "GRADED"
    And He thong thong bao "Luu diem thanh cong"
    And Sinh vien "sv_nam" co the xem duoc diem va loi nhan xet nay

  Scenario Outline: Nhap diem khong hop le (ngoai thang diem 0 - 10)
    When Giang vien nhap diem "<score>"
    And Giang vien nhan nut "Luu diem"
    Then He thong tu choi cap nhat
    And He thong hien thi thong bao loi "<error_message>"

    Examples:
      | score | error_message                             |
      | -1    | Diem so phai nam trong khoang tu 0 den 10 |
      | 10.5  | Diem so phai nam trong khoang tu 0 den 10 |
      | abc   | Diem so phai la chu so thap phan hop le   |

  Scenario: Giang vien khac khong co quyen cham bai cua khoa hoc nay (Chong IDOR)
    Given Giang vien "gv_khac" khong phai giang vien phu trach khoa hoc "CS101"
    When Giang vien "gv_khac" gui request POST den "/api/submissions/456/grade" de sua diem
    Then He thong kiem tra quyen so huu khoa hoc
    And He thong tu choi voi ma loi HTTP 403 Forbidden
```

---

### Epic E4: Thi Trắc nghiệm & Chấm tự động

#### US-10: Giảng viên tạo đề thi trắc nghiệm
> **As a** Giảng viên,  
> **I want to** tạo đề thi trắc nghiệm gồm danh sách câu hỏi nhiều lựa chọn, đặt đáp án đúng và thời gian làm bài (phút),  
> **So that** hệ thống tự động kiểm tra kiến thức của sinh viên.

*Quy tắc nghiệp vụ liên quan: BR-12, BR-13*

```gherkin
Feature: Tao de thi trac nghiem

  Background:
    Given Giang vien "gv_mai" dang quan ly khoa hoc "CS101"
    And Giang vien o trang "Quan ly de thi trac nghiem"

  Scenario: Tao de thi trac nghiem thanh cong
    When Giang vien nhan nut "Tao bai kiem tra moi"
    And Giang vien nhap tieu de "Kiem tra giua ky Trac nghiem"
    And Giang vien dat thoi luong lam bai la 30 phut
    And Giang vien them 3 cau hoi trac nghiem 4 lua chon va chon 1 dap an dung cho moi cau
    And Giang vien dat thoi gian mo de la "2026-11-25 08:00:00" va dong de la "2026-11-25 10:00:00"
    And Giang vien nhan nut "Luu de thi"
    Then He thong luu de thi o trang thai "DRAFT"
    And Tong so cau hoi duoc ghi nhan la 3
    And He thong bao "Tao de thi thanh cong"

  Scenario: Tu choi sua hoac xoa cau hoi khi de thi dang co sinh vien lam bai
    Given De thi "Quiz-01" dang o trang thai "IN_PROGRESS" va co 20 sinh vien dang thuc hien lam bai
    When Giang vien "gv_mai" co tinh sua dap an hoac xoa cau hoi trong "Quiz-01"
    Then He thong khoa tinh nang sua noi dung cau hoi
    And He thong thong bao "Khong the chinh sua de thi khi dang co thi sinh lam bai"
```

---

#### US-11: Sinh viên làm bài thi trắc nghiệm
> **As a** Sinh viên,  
> **I want to** làm bài thi trực tuyến với đồng hồ đếm ngược chính xác,  
> **So that** tôi hoàn thành bài kiểm tra công bằng và minh bạch.

*Quy tắc nghiệp vụ liên quan: BR-12, BR-14, BR-15*

```gherkin
Feature: Sinh vien lam bai thi trac nghiem

  Background:
    Given Sinh vien "sv_nam" da ghi danh vao khoa hoc "CS101"
    And De thi "Quiz-01" co thoi luong 30 phut dang mo cho sinh vien lam bai

  Scenario: Sinh vien bat dau lam bai thi thanh cong
    Given Sinh vien "sv_nam" chua tung lam bai thi "Quiz-01"
    When Sinh vien truy cap vao de thi va bam nut "Bat dau lam bai"
    Then He thong tao mot ban ghi Luot thi ("Attempt") voi thoi gian bat dau tinh theo server
    And He thong tinh toan thoi gian ket thuc toi da ("expire_at") = thoi gian bat dau + 30 phut
    And Man hinh hien thi danh sach cau hoi kem cac lua chon
    And Dong ho dem nguoc tren man hinh dong bo voi thoi gian con lai tinh tu server
    And Khong co bat ky thong tin dap an dung nao duoc gui ve client qua HTML hoac JSON API

  Scenario: Sinh vien tai lai trang (F5) hoac mat mang tam thoi khi dang thi
    Given Sinh vien "sv_nam" dang lam bai thi "Quiz-01" o phut thu 10
    And Sinh vien da chon dap an cho cau 1 va cau 2
    When Sinh vien bi rot mang hoac lo tay bam F5 de tai lai trang
    Then Khi trang web duoc mo lai, he thong tai lai Luot thi dang do
    And Cac dap an da chon truoc do cua cau 1 va cau 2 van duoc giu nguyen (auto-saved)
    And Dong ho tiep tuc dem nguoc tu thoi gian thuc te cua server (khong duoc reset 30 phut)

  Scenario: Ngan chan sinh vien mo lam bai thi tren 2 tab trinh duyet cung luc
    Given Sinh vien "sv_nam" dang lam bai thi tren Tab 1
    When Sinh vien mo them Tab 2 tren trinh duyet va bam lam lai bai thi nay
    Then He thong kiem tra ma phien luot thi
    And He thong tu choi tao luot thi moi o Tab 2
    And Tab 2 chi hien thi thong tin dong bo voi Tab 1 hoac hien canh bao "Ban dang lam bai o mot cua so khac"
```

---

#### US-12: Hệ thống tự động chấm điểm bài thi trắc nghiệm
> **As an** Hệ thống LMS,  
> **I want to** đối chiếu bài làm của sinh viên với bảng đáp án chuẩn trong cơ sở dữ liệu và tính điểm ngay khi nộp bài,  
> **So that** điểm số được ghi nhận chính xác, khách quan và tức thì.

*Quy tắc nghiệp vụ liên quan: BR-12, BR-13, BR-14*

```gherkin
Feature: Tu dong cham diem trac nghiem

  Background:
    Given De thi "Quiz-01" co 10 cau hoi, moi cau dung duoc 1.0 diem (thang diem 10)
    And Sinh vien "sv_nam" co luot thi hop le voi ma "ATT-999"

  Scenario: Sinh vien chu dong nhan nop bai thi truoc khi het gio
    Given Sinh vien con 5 phut lam bai
    And Sinh vien da chon dung 8 cau va sai 2 cau
    When Sinh vien nhan nut "Nop bai thi" va xac nhan "Dong y nop"
    Then He thong ghi nhan trang thai luot thi chuyen sang "SUBMITTED"
    And He thong thuc hien cham diem phia server trong 1 Database Transaction
    And Diem so duoc tinh la "8.0" / "10.0"
    And He thong hien thi diem ngay cho sinh vien (neu de thi cho phep xem diem ngay)

  Scenario: Tu dong thu bai khi dong ho dem nguoc het gio
    Given Dong ho dem nguoc cua server cho luot thi "ATT-999" cham moc 00:00:00
    When Sinh vien chua kip bam nut nop bai
    Then He thong tu dong trigger lenh dong luot thi (Auto-submit)
    And He thong ghi nhan cac dap an da luu den thoi diem do de cham diem
    And Trang thai luot thi chuyen thanh "AUTO_SUBMITTED"
    And He thong thong bao "Da het thoi gian lam bai! Bai thi cua ban da duoc tu dong nop"
```

---

### Epic E5: Bảng điểm & Thống kê kết quả

#### US-13: Sinh viên xem bảng điểm cá nhân
> **As a** Sinh viên,  
> **I want to** xem điểm số các bài tập và bài thi trắc nghiệm trong khóa học,  
> **So that** tôi theo dõi được tình hình và kết quả học tập của mình.

*Quy tắc nghiệp vụ liên quan: BR-09, BR-13*

```gherkin
Feature: Sinh vien xem bang diem ca nhan

  Background:
    Given Sinh vien "sv_nam" da dang nhap va vao khoa hoc "CS101"
    And Sinh vien vao muc "Diem so"

  Scenario: Xem danh sach diem da duoc cong bo
    Given Bai tap "BT-01" da duoc giang vien cham diem 8.5
    And Bai trac nghiem "Quiz-01" da co ket qua diem 8.0
    When Sinh vien mo bang diem
    Then He thong hien thi danh sach cac dau diem cua ca nhan sinh vien
    And Hien thi chi tiet: Ten bai danh gia, Diem so, Diem toi da, Nhan xet cua giang vien (neu co)

  Scenario: Sinh vien khong the xem diem cua sinh vien khac (Chong IDOR)
    When Sinh vien "sv_nam" co tinh thay doi student_id tren request API bang ID cua "sv_khac"
    Then He thong so sanh ID dang nhap voi ID trong request
    And He thong tu choi truy cap voi loi 403 Forbidden
```

---

#### US-14: Giảng viên xem và xuất bảng điểm tổng hợp lớp (Should)
> **As a** Giảng viên,  
> **I want to** xem danh sách điểm của tất cả sinh viên trong lớp và xuất ra tệp Excel/CSV,  
> **So that** tôi dễ dàng tổng kết điểm cuối kỳ và báo cáo cho phòng đào tạo.

*Quy tắc nghiệp vụ liên quan: BR-09, BR-16*

```gherkin
Feature: Giang vien xem va xuat bang diem tong hop

  Background:
    Given Giang vien "gv_mai" dang quan ly khoa hoc "CS101" co 45 sinh vien

  Scenario: Xem bang diem tong hop tren giao dien web
    When Giang vien vao trang "Bang diem tong hop"
    Then He thong hien thi bang dang luoi gom: Ma SV, Ho ten SV, Diem BT-01, Diem Quiz-01
    And Du lieu duoc phan trang (20 sinh vien moi trang)

  Scenario: Xuat bang diem ra file CSV thanh cong
    When Giang vien nhan nut "Xuat CSV"
    Then He thong tong hop toan bo diem cua 45 sinh vien va sinh file "BangDiem_CS101.csv"
    And Tep tin su dung encoding UTF-8 co BOM de tranh loi font tieng Viet tren Excel
    And Tep tin tu dong duoc tai xuong trinh duyet
```

---

### Epic E6: Tương tác, Thông báo & Thảo luận (Should)

#### US-15: Đăng và nhận thông báo trong khóa học
> **As a** Giảng viên,  
> **I want to** đăng thông báo lên bảng tin khóa học,  
> **So that** toàn bộ sinh viên trong lớp nắm được lịch học, thay đổi hạn nộp bài hoặc tin tức quan trọng.

*Quy tắc nghiệp vụ liên quan: BR-17*

```gherkin
Feature: Dang va xem thong bao khoa hoc

  Scenario: Giang vien dang thong bao thanh cong
    Given Giang vien "gv_mai" dang o trang chu khoa hoc "CS101"
    When Giang vien nhap tieu de "Doi lich hoc bu sang thu 7" va noi dung "Lop se hoc bu tu 8h sang phong A201"
    And Giang vien bam nut "Dang thong bao"
    Then He thong luu thong bao len bang tin cua khoa hoc voi thoi gian hien tai
    And Moi sinh vien khi vao khoa hoc deu nhin thay thong bao nay o dau trang

  Scenario: Sinh vien chi co quyen doc thong bao, khong co quyen dang thong bao
    Given Sinh vien "sv_nam" dang o khoa hoc "CS101"
    Then Sinh vien khong nhin thay nut hoac form "Dang thong bao" tren giao dien
    When Sinh vien co tinh goi API POST "/api/courses/CS101/announcements"
    Then He thong tra ve ma loi 403 Forbidden
```

---

#### US-16: Diễn đàn thảo luận bài học
> **As a** Sinh viên hoặc Giảng viên,  
> **I want to** gửi câu hỏi hoặc phản hồi câu hỏi của người khác trong chủ đề thảo luận,  
> **So that** chúng tôi trao đổi bài tập và giải đáp thắc mắc chuyên môn.

*Quy tắc nghiệp vụ liên quan: BR-18*

```gherkin
Feature: Thao luan bai hoc

  Scenario: Sinh vien gui cau hoi vao dien dan thao luan
    Given Sinh vien "sv_nam" dang xem bai hoc "Chuong 1"
    When Sinh vien nhap noi dung "Co oi cho em hoi su khac nhau giua REST va GraphQL o slide 5 a?"
    And Sinh vien bam nut "Gui binh luan"
    Then Binh luan xuat hien duoi bai hoc kem ten "sv_nam" va thoi gian vua gui

  Scenario: Ngan chan XSS khi nguoi dung nhap ma script vao noi dung binh luan
    When Nguoi dung nhap noi dung "<script>alert('hack')</script>"
    And Nguoi dung bam nut "Gui binh luan"
    Then He thong thuc hien sanitize/escape ma doc truoc khi luu va render ra giao dien
    And Doan ma tren chi hien thi dang chuoi text thuan tuy, khong bi thuc thi tren trinh duyet
```

---

## 5. Quy tắc Nghiệp vụ (Business Rules - BR)

- **BR-01 (Tài khoản & Định danh):** Tên đăng nhập (username) và Email phải là duy nhất trên toàn hệ thống. Mật khẩu phải có độ dài tối thiểu 8 ký tự, bao gồm ít nhất 1 chữ cái và 1 chữ số.
- **BR-02 (Khóa tài khoản tự động):** Nếu người dùng nhập sai mật khẩu 5 lần liên tiếp trong vòng 10 phút, tài khoản bị tạm khóa trong 15 phút để chống tấn công dò mật khẩu (brute-force).
- **BR-03 (Quyền sở hữu Khóa học):** Chỉ Giảng viên tạo khóa học mới có quyền chỉnh sửa thông tin, thêm bài giảng, tạo bài tập, tạo đề thi và chấm điểm trong khóa học đó.
- **BR-04 (Mã ghi danh - Enrollment Key):** Khóa học chỉ chấp nhận sinh viên ghi danh khi đang ở trạng thái `PUBLISHED`. Mã ghi danh phân biệt hoa thường, gồm 6-8 ký tự.
- **BR-05 (Ràng buộc thành viên):** Sinh viên chỉ có thể xem tài liệu, nộp bài tập, làm bài thi trắc nghiệm và tham gia thảo luận nếu đã được ghi nhận là thành viên của khóa học đó.
- **BR-06 (Giới hạn tài liệu):** Mỗi tệp tài liệu bài giảng tải lên có dung lượng tối đa 50MB. Chỉ hỗ trợ các định dạng: `.pdf`, `.docx`, `.pptx`, `.zip`, `.rar`.
- **BR-07 (Quy định Nộp bài tập):**
  - Tệp nộp bài tập tự luận có dung lượng tối đa 20MB.
  - Sinh viên được phép nộp lại (ghi đè) bài làm trước thời điểm hết hạn (deadline).
  - Nếu giảng viên bật tùy chọn "Cho phép nộp trễ", bài nộp sau deadline vẫn được ghi nhận nhưng đánh dấu cờ `Late` và lưu số phút nộp trễ. Nếu tắt tùy chọn này, hệ thống chặn hoàn toàn việc nộp bài sau deadline.
- **BR-08 (Thang điểm bài tập):** Điểm số bài tập tự luận là số thực trong đoạn `[0.0, 10.0]`, bước nhảy 0.25 điểm.
- **BR-09 (Bảo mật điểm số):** Điểm số chỉ được hiển thị cho chính sinh viên đó và giảng viên phụ trách khóa học. Sinh viên không được phép xem điểm của sinh viên khác.
- **BR-10 (Bảo mật tệp tải lên):** Tệp tải lên phải được lưu trữ với tên định danh duy nhất (UUID), không được thực thi trực tiếp trên server (lưu ngoài web root hoặc chặn quyền thực thi script như `.php`, `.sh`, `.exe`).
- **BR-11 (Xác thực quyền tải tệp):** Mọi request tải tệp nộp bài hoặc tài liệu đều phải đi qua middleware xác thực quyền truy cập (không dùng đường dẫn tĩnh cố định dẫn tới file lưu trữ).
- **BR-12 (Quy định Đề thi trắc nghiệm):** Mỗi câu hỏi có tối thiểu 2 lựa chọn và tối đa 5 lựa chọn, có ít nhất 1 đáp án đúng. Đề thi phải có ít nhất 1 câu hỏi mới được kích hoạt cho sinh viên làm.
- **BR-13 (Bảo mật đề thi phía Client):** Trong suốt quá trình sinh viên làm bài thi, API tuyệt đối không trả về thông tin đáp án đúng về phía client (trình duyệt).
- **BR-14 (Thời gian làm bài thi):**
  - Thời gian làm bài được tính dựa trên đồng hồ server (`started_at` và `expires_at`).
  - Khi `expires_at` đến hạn, hệ thống tự động khóa nhận đáp án và kích hoạt tính điểm tự động (Auto-submit).
- **BR-15 (Giới hạn lượt thi):** Trong phạm vi MVP, mỗi sinh viên chỉ được phép làm bài thi trắc nghiệm 1 lần duy nhất cho mỗi đề thi.
- **BR-16 (Xuất dữ liệu an toàn):** Tệp CSV/Excel xuất ra phải lọc và escape các ký tự khởi đầu bằng `=`, `+`, `-`, `@` để ngăn ngừa lỗ hổng CSV Injection.
- **BR-17 (Quyền thông báo):** Chỉ Giảng viên phụ trách khóa học và Admin mới có quyền tạo hoặc xóa thông báo trên bảng tin.
- **BR-18 (Kiểm soát nội dung thảo luận):** Mọi nội dung text nhập từ người dùng (bình luận, tên bài, mô tả) đều phải được lọc (sanitization) chống XSS trước khi hiển thị.
- **BR-19 (Quy định Lịch học):** Mỗi buổi học phải có ngày học, thời gian bắt đầu và thời gian kết thúc hợp lệ (`start_time < end_time`). Hệ thống kiểm tra và ngăn chặn việc tạo các buổi học bị trùng lặp hoặc chồng chéo khung giờ trong cùng một khóa học.
- **BR-20 (Quyền xem Lịch học):** Chỉ Giảng viên phụ trách và Sinh viên đã ghi danh thành công vào khóa học mới có quyền xem thông tin chi tiết lịch học, phòng học hoặc đường link học trực tuyến của khóa học đó.

---

## 6. Yêu cầu Phi chức năng (Non-Functional Requirements - NFR)

### 6.1. Hiệu năng & Khả năng đáp ứng (Performance)
- **NFR-01 (Thời gian phản hồi API):** 95% các yêu cầu HTTP thông thường (tải trang, xem danh sách, lấy nội dung bài giảng) phản hồi trong thời gian dưới **1.5 giây** trong điều kiện mạng bình thường.
- **NFR-02 (Thời gian nộp & chấm bài thi):** Thời gian tính điểm tự động và trả kết quả cho 1 bài thi trắc nghiệm không vượt quá **2.0 giây**.
- **NFR-03 (Tải đồng thời MVP):** Hệ thống phục vụ ổn định tối thiểu **100 người dùng hoạt động đồng thời (concurrent users)**, trong đó có tối thiểu **50 sinh viên cùng nộp bài trắc nghiệm hoặc bài tập trong khoảng thời gian 2 phút** mà không phát sinh lỗi 500 Internal Server Error.

### 6.2. Bảo mật & An toàn dữ liệu (Security)
- **NFR-04 (Mã hóa mật khẩu):** Mật khẩu người dùng bắt buộc phải được băm bằng thuật toán an toàn một chiều (ví dụ: BCrypt với work factor tối thiểu 10 hoặc Argon2) kèm salt ngẫu nhiên.
- **NFR-05 (Kiểm soát truy cập dựa trên vai trò - RBAC):** Mọi API endpoint nhạy cảm phải được bảo vệ bởi middleware kiểm tra token xác thực và phân quyền nghiêm ngặt.
- **NFR-06 (Phòng chống OWASP Top 10):**
  - Ngăn ngừa SQL Injection thông qua sử dụng Parameterized Query hoặc ORM an toàn.
  - Ngăn ngừa Broken Object Level Authorization (IDOR) bằng cách kiểm tra quyền sở hữu tài nguyên trên database ở mỗi request.
  - Ngăn ngừa Stored & Reflected XSS bằng cách escape toàn bộ nội dung HTML động.
  - Áp dụng Rate Limiting trên các endpoint nhạy cảm (Đăng nhập tối đa 5 lần/phút, Nộp bài tối đa 10 lần/phút).
- **NFR-07 (An toàn tải tệp):** Kiểm tra cả phần mở rộng (extension) và định dạng nội dung tệp thực tế (MIME type / Magic bytes) khi upload. Tệp được lưu trữ với tên mã hóa UUID.

### 6.3. Tính Toàn vẹn & Tin cậy của Dữ liệu (Reliability & Data Integrity)
- **NFR-08 (Database Transactions):** Quá trình nộp bài thi trắc nghiệm (ghi nhận đáp án, cập nhật trạng thái lượt thi, tính tổng điểm) phải được đóng gói trong **1 Transaction duy nhất**. Nếu có lỗi giữa chừng, toàn bộ thay đổi phải được Rollback.
- **NFR-09 (Soft Delete & Ràng buộc dữ liệu):** Không sử dụng cơ chế xóa cứng (Hard Delete) đối với khóa học hoặc tài khoản đã có dữ liệu phát sinh (bài tập, bài nộp, điểm). Áp dụng `Soft Delete` (`is_deleted = true`) để bảo tồn lịch sử học tập.

### 6.4. Tính Khả dụng & Tương thích (Usability & Compatibility)
- **NFR-10 (Khả năng tương thích trình duyệt):** Ứng dụng web hiển thị tốt và hoạt động không lỗi trên các trình duyệt hiện đại phổ biến: Google Chrome, Mozilla Firefox, Microsoft Edge, Safari phiên bản mới nhất.
- **NFR-11 (Giao diện đáp ứng - Responsive):** Giao diện tương thích tối thiểu trên 2 kích thước chuẩn: Màn hình máy tính (Desktop/Laptop, độ phân giải từ 1280x720 trở lên) và máy tính bảng/màn hình nhỏ (Tablet từ 768px trở lên).

---

## 7. Phản biện Edge Cases & Quản trị Rủi ro (Bảng EC-xx)

Dưới đây là 22 kịch bản biên và rủi ro kỹ thuật - nghiệp vụ được rà soát chi tiết theo 5 nhóm:

| Mã EC | Nhóm rủi ro | User Story liên quan | Tình huống chi tiết | Mức độ rủi ro | Giải pháp đối ứng trong thiết kế & thực thi |
|---|---|---|---|---|---|
| **EC-01** | Bảo mật | US-06, US-08, US-09, US-13 | **IDOR:** Sinh viên A đổi `submission_id` hoặc `student_id` trên đường dẫn URL/API để xem/tải bài nộp hoặc điểm của sinh viên B. | **Cao** | Bắt buộc kiểm tra quyền sở hữu tại backend: `WHERE submission.student_id = current_user.id OR course.owner_id = current_user.id`. Trả về 403 Forbidden nếu không khớp. |
| **EC-02** | Bảo mật | US-11, US-12 | **Lộ đáp án trắc nghiệm ở Client:** API tải câu hỏi trắc nghiệm kèm theo trường `is_correct` hoặc đáp án đúng về trình duyệt. | **Cao** | Endpoint API lấy danh sách câu hỏi cho sinh viên tuyệt đối không chứa trường đáp án đúng. Việc chấm điểm chỉ thực hiện hoàn toàn ở phía server. |
| **EC-03** | Bảo mật | US-05, US-08 | **Upload tệp chứa mã độc:** Người dùng tải lên tệp `.php`, `.sh`, `.exe` hoặc tệp giả mạo extension (`shell.php.pdf`) để chiếm quyền server. | **Cao** | Whitelist các định dạng cho phép, kiểm tra MIME type/magic bytes, đổi tên tệp thành UUID ngẫu nhiên khi lưu vào ổ đĩa, chặn quyền execute trong thư mục lưu trữ. |
| **EC-04** | Hiệu năng & Đồng thời | US-08, US-11 | **Race condition khi nộp bài (Double submit):** Sinh viên bấm nút "Nộp bài" liên tiếp nhiều lần do mạng chậm hoặc lag giao diện. | **Cao** | Frontend: Disable nút nộp ngay sau click đầu tiên kèm spinner. Backend: Sử dụng unique constraint hoặc distributed lock/mutex theo `attempt_id` / `(assignment_id, student_id)`. |
| **EC-05** | Toàn vẹn dữ liệu | US-12 | **Mất mát dữ liệu khi chấm điểm trắc nghiệm:** Server bị sập hoặc mất kết nối database đúng lúc đang lưu điểm bài thi. | **Cao** | Đưa toàn bộ chuỗi hành động (lưu đáp án + cập nhật trạng thái luot_thi sang SUBMITTED + lưu bảng điểm) vào 1 Database Transaction duy nhất (`BEGIN ... COMMIT`). |
| **EC-06** | Trạng thái biên | US-11, US-14 | **Lệch đồng hồ Client - Server:** Đồng hồ máy tính của sinh viên bị chỉnh chậm 1 tiếng so với thực tế để gian lận thời gian làm bài. | **Cao** | Thời gian đếm ngược và hạn chót hoàn toàn căn cứ theo `server_time`. Client chỉ nhận `remaining_seconds` tính từ server và định kỳ ping đồng bộ. |
| **EC-07** | Nghiệp vụ | US-10 | **Sửa đề thi trắc nghiệm khi sinh viên đang làm:** Giảng viên sửa đáp án hoặc xóa câu hỏi trong khi sinh viên đang trong phòng thi. | **Cao** | Khi có ít nhất 1 sinh viên bắt đầu làm bài (`status = IN_PROGRESS`), khóa hoàn toàn quyền sửa cấu trúc/đáp án đề thi. Chỉ cho phép sửa khi chưa có lượt thi nào. |
| **EC-08** | Bảo mật | US-01 | **Brute-force mật khẩu:** Kẻ tấn công dùng tool tự động thử hàng nghìn mật khẩu vào tài khoản giảng viên hoặc admin. | **Cao** | Cài đặt Rate Limiting ở API đăng nhập, tự động khóa tài khoản tạm thời 15 phút nếu nhập sai quá 5 lần liên tiếp (BR-02). |
| **EC-09** | Toàn vẹn dữ liệu | US-03, US-08, US-12 | **Xóa dây chuyền gây mất điểm (Cascade Delete):** Giảng viên bấm xóa bài tập hoặc xóa khóa học đã có điểm số của sinh viên. | **Cao** | Không xóa cứng (Hard delete). Nếu khóa học hoặc bài tập đã có bài nộp, chỉ cho phép "Lưu trữ" (Archive/Soft delete). Khóa học lưu trữ sẽ chuyển sang chế độ chỉ đọc. |
| **EC-10** | Trạng thái biên | US-11 | **F5 hoặc mất mạng khi đang thi trắc nghiệm:** Sinh viên vô tình tải lại trang hoặc rớt mạng WiFi trong lúc thi. | **Trung bình** | Tự động lưu đáp án đã chọn (Auto-save) sau mỗi lần click chọn đáp án qua API ngầm; khi load lại trang, khôi phục lại trạng thái bài làm từ database. |
| **EC-11** | Bảo mật | US-15, US-16 | **Stored XSS trong bài học và thảo luận:** Người dùng chèn thẻ `<script>` hoặc payload JavaScript vào nội dung bình luận, tiêu đề bài giảng. | **Trung bình** | Backend lọc (sanitize) toàn bộ nội dung HTML đầu vào bằng thư viện bảo mật (ví dụ DOMPurify, Bleach hoặc cơ chế template escaping mặc định). |
| **EC-12** | Nghiệp vụ | US-08 | **Nộp bài quá hạn chót (Deadline):** Sinh viên nộp bài chậm hơn hạn chót 1 vài giây hoặc vài phút. | **Trung bình** | Phân loại trạng thái bài nộp theo BR-07: nếu cho phép nộp trễ thì đánh dấu `SUBMITTED_LATE` và lưu số phút trễ, nếu không cho phép thì chặn nộp và báo lỗi rõ ràng. |
| **EC-13** | Trạng thái biên | US-11 | **Mở đề thi trên nhiều tab trình duyệt:** Sinh viên mở 2 tab cùng lúc để thử các phương án khác nhau. | **Trung bình** | Lưu `session_token` của lượt thi; nếu phát hiện request từ tab mới hoặc tab cũ không khớp token phien làm việc, cảnh báo và chỉ duy trì 1 phiên hoạt động. |
| **EC-14** | Trạng thái biên | US-08, US-11 | **Hết phiên đăng nhập (Token Expired) khi đang nộp bài:** Sinh viên làm bài lâu dẫn đến JWT/Session hết hạn, bấm nộp bài bị văng ra trang login. | **Trung bình** | Sử dụng cơ chế Refresh Token ngầm hoặc lưu tạm tệp/dữ liệu vào localStorage trước khi chuyển hướng đăng nhập để không làm mất bài của sinh viên. |
| **EC-15** | Nghiệp vụ | US-04 | **Sinh viên rời khỏi khóa học (Unenroll):** Xử lý điểm số và bài nộp cũ thế nào nếu sinh viên hủy tham gia khóa học. | **Trung bình** | Chỉ cho phép hủy ghi danh nếu chưa có bất kỳ điểm số nào phát sinh; nếu đã có bài nộp/điểm, không cho tự hủy ghi danh (phải do Giảng viên quản lý). |
| **EC-16** | Nghiệp vụ | US-09 | **Nhập điểm số là số âm hoặc lớn hơn thang điểm 10:** Giảng viên gõ nhầm điểm `-5` hoặc `15`. | **Trung bình** | Validate chặt chẽ ở cả Frontend và Backend theo BR-08: giá trị phải nằm trong `[0.0, 10.0]`. Báo lỗi ngay tại ô nhập điểm nếu sai định dạng. |
| **EC-17** | Bảo mật | US-14 | **CSV Injection khi xuất bảng điểm:** Tên sinh viên hoặc mã sinh viên chứa ký tự nguy hiểm (`=CMD(...)`, `@SUM...`). | **Trung bình** | Khi xuất tệp CSV, kiểm tra ký tự đầu tiên của mỗi ô; nếu là `=`, `+`, `-`, `@` thì tự động thêm dấu nháy đơn `'` ở đầu ô để vô hiệu hóa thực thi công thức. |
| **EC-18** | Hiệu năng | US-06, US-08 | **Nhiều sinh viên cùng tải tệp 50MB cùng lúc:** Làm nghẽn băng thông server web. | **Trung bình** | Stream file theo chunk, giới hạn dung lượng tải lên/xuống và khuyến khích cấu hình web server (Nginx/Storage) phục vụ static files trực tiếp. |
| **EC-19** | Toàn vẹn dữ liệu | US-05, US-08 | **Dữ liệu tệp mồ côi (Orphaned Files):** Upload file thành công lên ổ cứng nhưng thao tác ghi database bị lỗi dẫn đến file rác chiếm dung lượng. | **Thấp** | Viết script định kỳ (Cron job dọn dẹp) đối chiếu tệp vật lý trong storage với bảng ghi trong database để xóa tệp rác không có liên kết. |
| **EC-20** | Trạng thái biên | US-08 | **Tên tệp nộp bài có ký tự đặc biệt / tiếng Việt có dấu:** Tên tệp như `Báo Cáo #1 (Tập 2) !@.pdf` gây lỗi đường dẫn lưu trữ. | **Thấp** | Đổi tên tệp lưu trên ổ đĩa thành UUID dạng chuỗi thuần; chỉ lưu tên tệp gốc của sinh viên vào trường `original_filename` trong database. |
| **EC-21** | Hiệu năng | US-14 | **Truy vấn N+1 khi load bảng điểm cả lớp:** Lấy danh sách 50 sinh viên kèm bài nộp gây ra 50 câu query con làm chậm hệ thống. | **Thấp** | Thiết kế query tối ưu bằng cách sử dụng `JOIN` hoặc `Eager Loading` kèm phân trang hợp lý (20-30 sinh viên/trang). |
| **EC-22** | Nghiệp vụ | US-04 | **Brute-force mã ghi danh khóa học (Enrollment Key):** Kẻ xấu viết script thử ngẫu nhiên mã khóa học để vào lớp trái phép. | **Thấp** | Áp dụng mã ghi danh độ dài tối thiểu 6 ký tự gồm chữ và số; giới hạn tần suất nhập sai mã ghi danh (tối đa 5 lần thử/phút/IP). |
| **EC-23** | Nghiệp vụ | US-17 | **Trùng lặp lịch học trong cùng khóa học:** Giảng viên vô tình xếp 2 buổi học trùng khung giờ vào cùng một ngày. | **Trung bình** | Backend kiểm tra xung đột thời gian (`start_time`, `end_time`, `date`) trước khi lưu; nếu trùng thì chặn và báo lỗi cụ thể (BR-19). |
| **EC-24** | Nghiệp vụ | US-17, US-18 | **Giảng viên đổi lịch hoặc hủy buổi học:** Sinh viên không biết buổi học đã bị đổi lịch/hủy. | **Trung bình** | Cho phép Giảng viên cập nhật trạng thái buổi học (`SCHEDULED`, `RESCHEDULED`, `CANCELLED`); khi đổi lịch hệ thống tự động gắn nhãn thông báo nổi bật trên thời khóa biểu của sinh viên. |

---

### 5 Câu hỏi Cần Làm rõ với Khách hàng / GVHD

1. **Về chính sách nộp bài trễ (Late Submission):** Giảng viên có cần hệ thống tự động trừ điểm theo tỷ lệ phần trăm (ví dụ: trừ 10% mỗi ngày trễ) hay chỉ cần gắn cờ `Late` và số phút nộp trễ để giảng viên tự quyết định khi chấm? *(Đã giả định: Gắn cờ và ghi nhận số phút trễ, giảng viên tự trừ điểm khi chấm)*.
2. **Về số lần làm bài thi trắc nghiệm:** Sinh viên chỉ được làm bài 1 lần duy nhất hay giảng viên có thể cấu hình cho phép làm nhiều lần (lấy điểm cao nhất hoặc điểm trung bình)? *(Đã giả định cho MVP: Mỗi đề thi chỉ cho phép làm 1 lần)*.
3. **Về việc hiển thị đáp án sau khi thi trắc nghiệm:** Có cho phép sinh viên xem lại chi tiết từng câu đúng/sai kèm đáp án ngay sau khi nộp bài không, hay phải đợi đến khi đề thi đóng hoàn toàn để chống lộ đề cho các sinh viên thi sau? *(Đã giả định: Chỉ hiển thị tổng điểm ngay khi nộp; chi tiết câu đúng sai chỉ xem được sau khi đề thi kết thúc)*.
4. **Về việc quản lý tài khoản sinh viên:** Admin sẽ chủ động nhập danh sách tài khoản cho sinh viên/giảng viên, hay sinh viên được tự do bấm "Đăng ký tài khoản" (Sign up) qua trang web? *(Đã giả định cho MVP: Admin tạo tài khoản để kiểm soát danh tính chính xác theo vai trò)*.
5. **Về trọng số tính điểm tổng kết khóa học:** Hệ thống có cần tự động tính điểm tổng kết học phần theo tỷ lệ phần trăm cấu hình sẵn (ví dụ: Chuyên cần 10% + Bài tập 30% + Trắc nghiệm giữa kỳ 20% + Cuối kỳ 40%) không? *(Đã giả định: Bảng điểm MVP hiển thị chi tiết điểm từng cột, việc tính điểm tổng kết hoãn sang giai đoạn sau)*.

---

## 8. Ngoài Phạm vi, Giả định và Ràng buộc

### 8.1. Ngoài phạm vi (Out of Scope - Không làm trong MVP)
- Thanh toán học phí trực tuyến, cổng thanh toán hoặc ví điện tử.
- Lớp học trực tuyến thời gian thực (Live video streaming, WebRTC, tích hợp Zoom/Google Meet).
- Ứng dụng di động độc lập (Native Mobile App Android/iOS) - chỉ tập trung phiên bản Web App.
- Chống gian lận thi trắc nghiệm mức nâng cao (không tích hợp giám sát qua Webcam AI, chặn tổ hợp phím hệ thống của OS).
- Đăng nhập qua bên thứ ba (Google OAuth, Facebook, SSO trường học) - chỉ dùng username/password chuẩn.
- Ngân hàng câu hỏi nâng cao với câu hỏi ghép nối, điền vào chỗ trống, câu hỏi âm thanh/video phức tạp (chỉ làm trắc nghiệm 1 đáp án đúng).

### 8.2. Giả định (Assumptions)
1. **Dữ liệu người dùng:** Hệ thống phục vụ cho các lớp học nội bộ quy mô vừa và nhỏ; tài khoản được Admin khởi tạo trước hoặc phân quyền chuẩn mực.
2. **Hạ tầng lưu trữ:** Tệp bài tập và tài liệu học tập được lưu trữ trực tiếp trên máy chủ ứng dụng (hoặc local storage) trong thư mục riêng biệt được bảo vệ bởi quyền truy cập file của hệ điều hành.
3. **Múi giờ hệ thống:** Toàn bộ hệ thống thống nhất sử dụng múi giờ Việt Nam (`Asia/Ho_Chi_Minh` - GMT+7) cho mọi mốc thời gian (hạn nộp bài, thời gian mở/đóng đề thi, lịch sử nộp bài).
4. **Thang điểm chuẩn:** Thống nhất sử dụng thang điểm 10 (thập phân) cho toàn bộ các bài đánh giá theo quy chế đào tạo phổ biến tại Việt Nam.

### 8.3. Ràng buộc (Constraints)
- **Ràng buộc thời gian:** Dự án thực hiện trong khung thời gian 1–2 tháng, đòi hỏi quy trình phát triển tập trung vào tính năng lõi (Must-have).
- **Ràng buộc nhân lực:** Nhóm thực hiện gồm đúng 3 thành viên (sinh viên), do đó việc phân chia module phải độc lập, giảm thiểu phụ thuộc chéo.
- **Ràng buộc kỹ thuật:** Chưa chọn framework hay công nghệ cụ thể ở giai đoạn này; tuy nhiên thiết kế logic nghiệp vụ phải đảm bảo tính khả thi cao khi ánh xạ sang bất kỳ kiến trúc Web MVC hoặc RESTful API nào.

---

## 9. Ma trận Truy vết Yêu cầu (Traceability Matrix: FR -> US -> Epic)

| Mã FR | Tên yêu cầu chức năng | Mã US | Mã Epic | Độ ưu tiên | Số Scenarios Gherkin | Rủi ro/EC đối ứng |
|---|---|---|---|---|---|---|
| **FR-01** | Đăng nhập hệ thống & Phân quyền | US-01 | E1 | Must | 4 | EC-08 |
| **FR-02** | Quản lý tài khoản người dùng & Khóa tài khoản | US-02 | E1 | Must | 3 | EC-08 |
| **FR-03** | Giảng viên tạo và cấu hình khóa học | US-03 | E2 | Must | 3 | EC-09 |
| **FR-04** | Sinh viên ghi danh bằng Enrollment Key | US-04 | E2 | Must | 3 | EC-15, EC-22 |
| **FR-05** | Giảng viên đăng tài liệu bài giảng | US-05 | E2 | Must | 3 | EC-03, EC-19 |
| **FR-06** | Sinh viên xem và tải tài liệu học tập | US-06 | E2 | Must | 2 | EC-01, EC-18 |
| **FR-07** | Giảng viên tạo và giao bài tập tự luận | US-07 | E3 | Must | 2 | EC-09, EC-12 |
| **FR-08** | Sinh viên nộp bài tập đính kèm tệp | US-08 | E3 | Must | 4 | EC-03, EC-04, EC-12, EC-14, EC-20 |
| **FR-09** | Giảng viên chấm điểm và nhận xét bài tự luận | US-09 | E3 | Must | 3 | EC-01, EC-16 |
| **FR-10** | Giảng viên tạo đề thi trắc nghiệm | US-10 | E4 | Must | 2 | EC-07 |
| **FR-11** | Sinh viên làm bài thi trắc nghiệm trực tuyến | US-11 | E4 | Must | 3 | EC-02, EC-06, EC-10, EC-13 |
| **FR-12** | Hệ thống tự động chấm điểm bài thi trắc nghiệm | US-12 | E4 | Must | 2 | EC-05, EC-06 |
| **FR-13** | Sinh viên xem bảng điểm cá nhân | US-13 | E5 | Must | 2 | EC-01 |
| **FR-14** | Giảng viên xem và xuất bảng điểm lớp học | US-14 | E5 | Should | 2 | EC-17, EC-21 |
| **FR-15** | Đăng và nhận thông báo khóa học | US-15 | E6 | Should | 2 | EC-11 |
| **FR-16** | Diễn đàn thảo luận bài học | US-16 | E6 | Should | 2 | EC-11 |
| **FR-17** | Giảng viên thiết lập và quản lý lịch học | US-17 | E2 | Should | 3 | EC-23, EC-24 |
| **FR-18** | Sinh viên xem thời khóa biểu & lịch học | US-18 | E2 | Should | 2 | EC-24 |
| **Tổng cộng** | **18 Yêu cầu chức năng (FR)** | **18 US** | **6 Epics** | **13 Must, 5 Should** | **44 Scenarios** | **24 ECs** |

---

## 10. Kế hoạch Phân công 3 Người theo Module (Work Breakdown for 3 Students)

Để đảm bảo tiến độ hoàn thành trong 1–2 tháng với 3 sinh viên, phạm vi công việc được phân rã thành 3 module độc lập, ranh giới rõ ràng:

```
+-----------------------------------------------------------------------------------------+
|                                      LMS MINI SYSTEM                                    |
+----------------------------+----------------------------+-------------------------------+
|     SINH VIÊN 1 (M1)       |      SINH VIÊN 2 (M2)      |       SINH VIÊN 3 (M3)        |
| Core Auth & Course Mgmt    |  Assignment & Gradebook    |  Quiz Engine & Interactions   |
+----------------------------+----------------------------+-------------------------------+
| - Epic E1: Auth & User     | - Epic E3: Bài tập tự luận | - Epic E4: Đề thi trắc nghiệm |
|   (Đăng nhập, RBAC, Admin) |   (Tạo BT, Deadline, Nộp)  |   (Tạo đề, ngân hàng câu hỏi) |
| - Epic E2: Khóa học, Bài   | - Epic E3: Chấm điểm tự    | - Epic E4: Thi trực tuyến &   |
|   giảng & Lịch học (Ghi    |   luận & Phản hồi          |   chấm điểm tự động           |
|   danh, Tài liệu, Lịch)    | - Epic E5: Bảng điểm cá    | - Epic E6: Bảng tin thông     |
| - Hạ tầng Base & Phân      |   nhân & Xuất file CSV     |   báo & Thảo luận bài học     |
|   quyền chung              | - Kiểm soát an toàn file   | - Cơ chế Auto-save & Timer    |
+----------------------------+----------------------------+-------------------------------+
```

### Chi tiết phân công:

#### 1. Sinh viên 1: Module Nền tảng, Xác thực & Quản lý Khóa học
- **Phạm vi phụ trách:** Epic E1 (US-01, US-02) và Epic E2 (US-03, US-04, US-05, US-06, US-17, US-18).
- **Đầu việc cụ thể:**
  - Thiết kế cấu trúc cơ sở dữ liệu cho User, Role, Course, Enrollment, Lesson, Material, Schedule/Session.
  - Xây dựng luồng xác thực (Authentication), phân quyền (Authorization - RBAC), cơ chế chống brute-force đăng nhập.
  - Quản lý khóa học, sinh mã ghi danh (Enrollment Key), xác thực ghi danh của sinh viên.
  - Quản lý tài liệu bài giảng, upload và stream tải tài liệu an toàn.
  - Quản lý lịch học khóa học: tạo lịch học, kiểm tra xung đột thời gian, thời khóa biểu cho sinh viên.
- **Tiêu chí hoàn thành (DoD):** Chạy thông suốt kịch bản (1): Giảng viên tạo khóa học, tải bài giảng, thiết lập lịch học; sinh viên ghi danh, xem thời khóa biểu và tải tài liệu học.

#### 2. Sinh viên 2: Module Bài tập Tự luận & Bảng điểm
- **Phạm vi phụ trách:** Epic E3 (US-07, US-08, US-09) và Epic E5 (US-13, US-14).
- **Đầu việc cụ thể:**
  - Thiết kế cấu trúc cơ sở dữ liệu cho Assignment, Submission, Grade.
  - Xây dựng luồng tạo bài tập, kiểm soát deadline, cho phép cấu hình nộp trễ.
  - Xây dựng luồng nộp bài của sinh viên: xử lý tệp nộp, chống double submit, xử lý nộp lại.
  - Giao diện và API chấm điểm tự luận cho giảng viên (thang điểm 10, nhận xét).
  - Tổng hợp bảng điểm cá nhân của sinh viên và xuất bảng điểm lớp ra file CSV an toàn (chống CSV Injection).
- **Tiêu chí hoàn thành (DoD):** Chạy thông suốt kịch bản (2): Giảng viên giao bài tập; sinh viên nộp tệp bài làm; giảng viên chấm điểm và sinh viên xem được điểm.

#### 3. Sinh viên 3: Module Đề thi Trắc nghiệm & Tương tác Lớp học
- **Phạm vi phụ trách:** Epic E4 (US-10, US-11, US-12) và Epic E6 (US-15, US-16).
- **Đầu việc cụ thể:**
  - Thiết kế cấu trúc cơ sở dữ liệu cho Quiz, Question, Option, Attempt, AttemptAnswer, Announcement, Discussion.
  - Xây dựng luồng tạo đề thi trắc nghiệm, quản lý câu hỏi và đáp án đúng.
  - Xây dựng giao diện phòng thi trắc nghiệm cho sinh viên: đồng hồ đếm ngược căn theo server time, tự động lưu đáp án (auto-save khi chọn), chống lộ đáp án ở client.
  - Thuật toán chấm điểm tự động và ghi nhận kết quả trong 1 database transaction.
  - Xây dựng bảng tin thông báo khóa học và diễn đàn thảo luận bài học (có chống XSS).
- **Tiêu chí hoàn thành (DoD):** Chạy thông suốt kịch bản (3): Giảng viên tạo đề thi trắc nghiệm; sinh viên vào thi với đồng hồ đếm ngược; hệ thống tự động chấm điểm và công bố kết quả.

