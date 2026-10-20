---
name: uml-specification
description: Vai trò UML Specification. Dùng khi cần xuất sơ đồ UML bằng cú pháp khai báo (Mermaid.js hoặc PlantUML) thay vì vẽ tay, gồm erd.mermaid và sequence.puml cho các luồng API chính, từ PRD và kiến trúc.
---

# UML Specification (sơ đồ bằng mã)

## Nguyên tắc
Sơ đồ là mã, lưu trong Git, sửa được bằng diff. Không vẽ tay, không xuất ảnh thay cho mã.

## Đầu vào
`docs/PRD.md`, `docs/architecture.md`, `docs/database.md` nếu đã có.

## Đầu ra (thư mục docs/diagrams/)
| File | Nội dung | Công cụ xem |
|---|---|---|
| `erd.mermaid` | Sơ đồ thực thể quan hệ | mermaid.live |
| `sequence.puml` | Sơ đồ tuần tự các luồng API chính | plantuml.com/plantuml |
| `usecase.mermaid` | Use case dạng flowchart (tùy chọn) | mermaid.live |
| `state.mermaid` | Vòng đời khóa học, bài nộp, lượt thi (tùy chọn) | mermaid.live |

## Quy trình
1. Chọn luồng cần vẽ sequence: mọi User Story nhóm Must có logic nhiều bước
   (đăng nhập, nộp bài, chấm bài, thi trắc nghiệm, ghi danh).
2. Mỗi luồng một sơ đồ trong `sequence.puml` (nhiều khối `@startuml ... @enduml`),
   mỗi sơ đồ có `title` ghi mã User Story.
3. Participant theo kiến trúc: Người dùng, Giao diện, Controller, Service, Repository, CSDL.
   Thông điệp dùng đúng tên endpoint (METHOD /đường-dẫn) và mã trạng thái HTTP.
4. Thể hiện đủ nhánh lỗi bằng `alt / else / opt / loop` và Note cho Quy tắc nghiệp vụ.
5. ERD lấy đúng từ `docs/database.md` hoặc schema; không tự thêm bảng mới.

## Mẫu PlantUML
```
@startuml
title US-10 Nop bai tap
autonumber
actor SV as "Sinh vien"
participant "Controller" as C
participant "Service" as S
database "CSDL" as DB
SV -> C : POST /api/v1/assignments/{id}/submissions
C -> S : submit(studentId, assignmentId, payload)
S -> DB : kiem tra enrollment va han nop
alt Hop le
  S -> DB : luu submission
  C --> SV : 201 Created
else Qua han va khong cho nop tre
  C --> SV : 400 Da qua han nop bai
end
@enduml
```

## Kiểm tra trước khi xong
- Cú pháp hợp lệ (render được trên công cụ xem).
- Tên thực thể, endpoint, trạng thái khớp PRD và kiến trúc.
- Danh sách sơ đồ đã vẽ và User Story tương ứng ở cuối câu trả lời.
