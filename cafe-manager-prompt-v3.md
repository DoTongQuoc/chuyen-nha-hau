# Prompt: Xây dựng Web App Quản Lý Quán Cafe

## Tổng quan
Xây dựng web app quản lý quán cafe, dùng cho **1 người duy nhất** (không phân quyền, không cần multi-user). Dùng được trên cả điện thoại lẫn máy tính, data sync realtime giữa các thiết bị.

---

## Tech Stack
| Phần | Công nghệ |
|---|---|
| Ngôn ngữ | HTML + CSS + Vanilla JavaScript (không dùng framework) |
| Database | Firebase Firestore (realtime sync) |
| Auth | Firebase Authentication (1 tài khoản duy nhất) |
| Deploy | GitHub Pages |
| Xuất ảnh | html2canvas |
| QR chuyển khoản | VietQR API (miễn phí, không cần đăng ký) |

---

## Giao diện tổng quan
- **Sidebar trái**: Xếp lịch / Tính lương / Nhân viên / Cài đặt
- Mỗi trang có **stat cards** tổng kết ở trên cùng
- Responsive: dùng được trên mobile và desktop
- Nút **Xuất PNG** ở topbar mỗi trang
- Các module **liên kết với nhau**:
  - Bấm chip tên NV trên lịch → mở trang chi tiết NV đó
  - Trang chi tiết NV → bấm "Xem lương tháng này" → sang trang lương filter sẵn NV đó
  - Trang lương → bấm "Xem chi tiết giờ làm" → sang lịch tháng đó filter sẵn NV đó
  - Cảnh báo ca thiếu người → bấm → nhảy thẳng đến ô đó trên bảng lịch

---

## Xuất ảnh PNG (dùng chung toàn app)
- **Mobile** → lưu thẳng vào album ảnh (Web Share API)
- **Desktop** → download file bình thường
```js
async function exportToPNG(elementId, filename) {
  const element = document.getElementById(elementId);
  const canvas = await html2canvas(element);
  const blob = await new Promise(r => canvas.toBlob(r));
  const file = new File([blob], filename, { type: "image/png" });
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (isMobile && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
}
```
> Lưu ý: Web Share API yêu cầu HTTPS — cần deploy lên GitHub Pages, không dùng được trên localhost.

---

## Module 1: Xếp Lịch Nhân Viên

> **Chỉ áp dụng cho nhân viên Phục Vụ** (`salaryType = "hourly"`).  
> Đầu bếp và Tạp vụ lương cố định, làm full tháng → không cần xếp ca.

### Ca làm việc
| Ca | Giờ mặc định | Màu hiển thị |
|---|---|---|
| Sáng | 06:00 – 13:00 | Vàng cam |
| Chiều | 13:00 – 18:00 | Xanh dương |
| Tối | 18:00 – 23:00 | Tím |

### Quy tắc
- Xếp lịch theo **tuần** trong tháng
- Mỗi ca tối thiểu **2 người** — cảnh báo nếu thiếu
- Manager tự xếp và sửa lịch trực tiếp trên app
- **Không có** tính năng NV tự đăng ký hoặc yêu cầu đổi ca
- NV trao đổi trực tiếp với manager → manager tự sửa trên app

### Ca gãy
- NV có thể vào muộn hoặc về sớm hơn giờ cố định của ca
- Khi thêm NV vào ca: nhập **giờ vào + giờ ra** cụ thể
- Nếu giờ vào/ra khác giờ cố định → tự động đánh dấu **ca gãy**
- Ca gãy hiển thị chip **viền nét đứt** trên bảng lịch
- Lương tính theo **giờ thực tế** (giờ ra - giờ vào) × đơn giá ca đó

### Hiển thị bảng lịch
- Header cột: **Thứ + Ngày/Tháng** (ví dụ: T2 / 16/6)
- Nút chuyển tuần ← →
- Mỗi ô: chip tên NV + giờ làm thực tế
- Bấm **chip** → sửa giờ vào/ra
- Bấm **+** → thêm NV vào ca (chỉ hiện danh sách NV `salaryType = "hourly"`)
- Bấm **tên NV** → mở trang chi tiết NV đó

### Xuất PNG
- Chụp bảng lịch tuần hiện tại
- Tên file: `lich-tuan-X-thang-Y.png`

---

## Module 2: Tính Lương

### Chu kỳ lương
- Tính theo **tháng**: ngày 1 → ngày cuối tháng
- Mỗi tháng chốt 1 lần

### Loại lương theo nhân viên
Mỗi nhân viên có `salaryType` trong hồ sơ xác định cách tính lương:

| salaryType | Áp dụng cho | Cách tính lương cơ bản |
|---|---|---|
| `hourly` | Phục vụ | Σ (giờ làm thực tế × đơn giá/giờ theo ca) |
| `fixed` | Đầu bếp, Tạp vụ | `fixedSalary` cố định mỗi tháng |

### Đơn giá ca (chỉ dùng cho NV `hourly`)
Cấu hình toàn quán — áp dụng cho tất cả NV phục vụ:
- Giá/giờ ca Sáng: X đ
- Giá/giờ ca Chiều: Y đ
- Giá/giờ ca Tối: Z đ (thường cao hơn do phụ cấp tối)

### Công thức tính lương

```
── Nhân viên Phục Vụ (hourly) ──
Giờ làm thực tế = giờ ra - giờ vào (tính cả ca gãy)
Đơn giá         = theo ca NV làm (sáng/chiều/tối)
Lương cơ bản    = Σ (giờ làm thực tế × đơn giá ca tương ứng)

── Đầu Bếp / Tạp Vụ (fixed) ──
Lương cơ bản    = fixedSalary (không phụ thuộc giờ làm)

── Tất cả ──
Thực lĩnh = Lương cơ bản + Σ thưởng - Σ phạt - Σ tạm ứng
```

> **Tip** được nhập chung vào mục **Thưởng**, không có mục riêng.

### Thưởng / Phạt
- Manager nhập thủ công: loại (thưởng/phạt), số tiền, lý do
- Dùng cho cả thưởng chuyên cần, thưởng trách nhiệm, tip, phạt đi muộn...
- Lưu lịch sử: thời gian tạo
- Xoá mềm (`isDeleted = true`), không xoá hẳn khỏi DB

### Tạm ứng
- Manager nhập: số tiền, ngày ứng, ghi chú
- Tự động trừ vào lương cuối tháng

### Trạng thái lương
```
Chưa chốt (draft) → Đã chốt (locked) → Đã thanh toán (paid)
```
- **Chưa chốt**: có thể sửa thưởng/phạt/tạm ứng
- **Đã chốt**: khoá, không sửa được, chỉ admin mở lại
- **Đã thanh toán**: lưu ngày thanh toán, khoá hoàn toàn

### Chuyển khoản qua QR VietQR
- Bấm nút chuyển khoản → hiện **QR VietQR** tự sinh
- URL sinh QR:
```
https://img.vietqr.io/image/{bank_id}-{stk}-compact.png
  ?amount={số tiền thực lĩnh}
  &addInfo=Luong thang {MM/YYYY} {tên NV}
  &accountName={tên chủ TK}
```
- Có nút **copy STK + số tiền** thủ công
- Sau khi chuyển → bấm "Đã thanh toán" → lưu ngày

### Xuất PNG
- **Từng người**: chi tiết lương cơ bản (giờ làm nếu hourly / lương cố định nếu fixed), thưởng/phạt, tạm ứng, số TK ngân hàng, thực lĩnh
- **Tất cả**: bảng tổng hợp toàn bộ NV trong tháng
- Hiện logo quán + tháng trên ảnh (cấu hình được)

---

## Module 3: Quản Lý Nhân Viên

### Thông tin lưu trữ
```
Staff
─────
name          họ tên
phone         số điện thoại
role          vai trò (phục vụ / đầu bếp / tạp vụ...)
startDate     ngày vào làm
note          ghi chú tự do (đánh giá, lý do tăng lương...)
isDeleted     xoá mềm

salaryType    "hourly" | "fixed"
fixedSalary   số tiền lương cố định/tháng (chỉ dùng nếu salaryType = "fixed")

bank:
  bankName        tên ngân hàng
  accountNumber   số tài khoản
  accountName     tên chủ tài khoản
```

### Giao diện
- **Card NV**: hiển thị avatar, tên, vai trò, loại lương, số TK ngân hàng, nút Sửa/Xoá
- **Bấm vào card** → mở **trang chi tiết NV** (view only):
  - Thông tin cá nhân + ngân hàng
  - Loại lương: hiển thị rõ "Lương theo giờ" hoặc "Lương cố định: X đ/tháng"
  - Ghi chú (`note`)
  - Thống kê nhanh tháng này:
    - Nếu `hourly`: tổng giờ làm, lương dự kiến, số ca gãy
    - Nếu `fixed`: lương cố định, thưởng/phạt tháng này, thực lĩnh dự kiến
  - Nút "Xem lương tháng này" → link sang trang lương filter NV đó
  - Nút "Chỉnh sửa" → mở modal edit
- **Modal edit**: chỉnh toàn bộ thông tin bao gồm `salaryType`, `fixedSalary`, `note`
- **Xoá mềm**: không xoá hẳn, chỉ set `isDeleted = true`

---

## Module 4: Cài Đặt

### Thông tin quán
- Tên quán, địa chỉ, số điện thoại, logo
- Logo hiện trên PNG xuất ra (nếu bật)

### Cấu hình ca làm
- Giờ bắt đầu / kết thúc từng ca (sáng/chiều/tối)
- Tên ca (có thể đổi tên tuỳ ý)
- Số NV tối thiểu mỗi ca (mặc định: 2)

### Bảng đơn giá ca (dùng cho NV hourly)
- Giá/giờ ca Sáng
- Giá/giờ ca Chiều
- Giá/giờ ca Tối

### Cấu hình xuất PNG
- Hiện/ẩn logo quán trên ảnh xuất
- Hiện/ẩn số TK trên phiếu lương

### Tài khoản
- Đổi email / mật khẩu đăng nhập

---

## Cấu trúc Firebase Firestore

```
/settings                          ← 1 document duy nhất
  shopInfo: { name, address, phone, logo }
  caConfig: {
    sang:  { name, start, end, minStaff }
    chieu: { name, start, end, minStaff }
    toi:   { name, start, end, minStaff }
  }
  wageConfig: { sang, chieu, toi } ← đ/giờ (chỉ dùng cho hourly)
  exportConfig: { showLogo, showBankInfo }

/staff/{staffId}
  name, phone, role, startDate, note
  isDeleted: false
  salaryType: "hourly" | "fixed"
  fixedSalary: number              ← chỉ có nếu salaryType = "fixed"
  bank: { bankName, accountNumber, accountName }

/schedules/{scheduleId}            ← chỉ tạo cho NV hourly (phục vụ)
  staffId
  date: "2026-06-16"               ← format YYYY-MM-DD
  shiftKey: "sang" | "chieu" | "toi"
  startTime: "06:00"
  endTime: "13:00"
  isBroken: false                  ← tự tính khi lưu

/adjustments/{id}                  ← thưởng / phạt / tip
  staffId
  month: "2026-06"                 ← format YYYY-MM
  type: "bonus" | "penalty"
  amount
  reason
  createdAt
  isDeleted: false

/advances/{id}                     ← tạm ứng
  staffId
  month: "2026-06"
  amount
  date
  note

/salaryStatus/{staffId_month}      ← key: "abc123_2026-06"
  staffId
  month: "2026-06"
  status: "draft" | "locked" | "paid"
  paidAt
```

### Query thường dùng
```js
// Lịch theo tuần (chỉ NV hourly)
where("date", ">=", "2026-06-16")
where("date", "<=", "2026-06-22")

// Ca của 1 NV trong tháng
where("staffId", "==", staffId)
where("date", ">=", "2026-06-01")
where("date", "<=", "2026-06-30")

// Trạng thái lương
doc("salaryStatus/abc123_2026-06")

// Thưởng/phạt của NV trong tháng
where("staffId", "==", staffId)
where("month", "==", "2026-06")
where("isDeleted", "==", false)
```

---

## Logic tính lương (chi tiết)

```js
async function calculateSalary(staffId, month) {
  const staff = await getStaff(staffId);

  let baseSalary = 0;

  if (staff.salaryType === "fixed") {
    // Đầu bếp / Tạp vụ: lấy lương cố định
    baseSalary = staff.fixedSalary;
  } else {
    // Phục vụ: tính từ giờ làm thực tế
    const schedules = await getSchedulesOfMonth(staffId, month);
    const wageConfig = await getWageConfig(); // { sang, chieu, toi }
    for (const s of schedules) {
      const hours = calcHours(s.startTime, s.endTime);
      baseSalary += hours * wageConfig[s.shiftKey];
    }
  }

  const adjustments = await getAdjustments(staffId, month); // thưởng/phạt
  const advances = await getAdvances(staffId, month);       // tạm ứng

  const totalBonus   = adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + a.amount, 0);
  const totalPenalty = adjustments.filter(a => a.type === "penalty").reduce((s, a) => s + a.amount, 0);
  const totalAdvance = advances.reduce((s, a) => s + a.amount, 0);

  const netSalary = baseSalary + totalBonus - totalPenalty - totalAdvance;

  return { baseSalary, totalBonus, totalPenalty, totalAdvance, netSalary };
}
```

---

## Lưu ý kỹ thuật
- Firebase Firestore không sleep, không cần restart, miễn phí (Spark Plan)
- Giới hạn free: 50.000 đọc/ngày, 20.000 ghi/ngày — quá dư cho quán nhỏ
- Không dùng 90 ngày → vào Firebase Console kích hoạt lại (data không mất)
- Firestore sync realtime **< 1 giây** giữa các thiết bị
- Có offline cache tự động — mất mạng vẫn xem được, tự sync lại khi có mạng
- Yêu cầu **HTTPS** để dùng Web Share API (xuất ảnh vào album mobile)
- Khi filter danh sách NV cho module xếp lịch: chỉ lấy NV có `salaryType = "hourly"` và `isDeleted = false`
