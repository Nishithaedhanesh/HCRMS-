# Add Bills and Generate Mess Bill for Admin

This plan outlines the steps to add comprehensive mess bill calculation and management to the Admin Dashboard.

## Goal Description
The objective is to allow the Admin to:
1. Add shop bills (purchases) for specific hostel blocks and months.
2. Generate a comprehensive "Mess Bill Calculation" report matching the provided physical format.
3. View the mess data (daily and monthly reports) of all students, similar to the Committee's view.
4. Set the fee for all students based on the calculated mess bill parameters.

## User Review Required
> [!IMPORTANT]
> - Do you want the "Add Bill" form to auto-calculate the 'Total' (Bill Amount + Debt)?yes
> - Should the generated "Mess Bill" PDF/page be printable?yes
> - For calculating the fees for each student: Is the formula `(Student's Total Meals * Rate Per Day) + Establishment Charge Per Head + Cook Charge Per Head` correct based on the physical bill?yes
> - The physical bill handles "Hostel Group" (e.g., LHA & C blocks). I will map the bill generation to the `hostel_group` so it aligns with the existing architecture.yes

## Proposed Changes

### Database Schema Updates
We'll create a `run-migration-v6.js` script to add the new tables:
- `Bills`: Stores individual shop bills (invoice no, shop name, amount, debt, total, date, hostel_group).
- `Mess_Bills`: Stores the monthly calculated variables per hostel group (opening balance, closing stock, estt charge, cook charge, calculated rate per day, estt per head, cook per head).

#### [NEW] backend/run-migration-v6.js
Will add `Bills` and `Mess_Bills` tables. It will also drop/alter the existing `Fees` table or we will just use the new `Mess_Bills` to get the per-student fee.

### Backend Routes (Admin)

#### [MODIFY] backend/routes/admin.js
- Add endpoints for CRUD operations on `Bills`.
- Add endpoint `/generate-mess-bill` which:
  - Takes input params (Opening Balance, Closing Stock, Estt Charge, Cook Charge, etc.)
  - Queries `Bills` to calculate `Purchase` sum for the month/group.
  - Queries `Meals` to calculate total inmates and total points for the month/group.
  - Returns the calculated Mess Bill summary.
- Add endpoint to Save the calculated Mess Bill to DB.
- Expose the daily and monthly mess report endpoints (similar to `committee.js` but allowing Admin to select the hostel group/block).

#### [MODIFY] backend/routes/student.js
- Update the student dashboard to display their specific fee for the month based on the `Mess_Bills` rates and their total points (meals), rather than the old `Fees` table simple rate.

### Frontend UI (Admin Dashboard)

#### [MODIFY] frontend/admin.html
- Add new sidebar/grid items: "Manage Bills", "Generate Mess Bill", "Mess Reports" (Daily/Monthly).
- **Manage Bills Section**:
  - Form to add new bills (SI No, Invoice No, Shop Name, Date, Hostel Group, Bill Amount, Debt, Total).
  - Table to view added bills for a selected month/group.
- **Generate Mess Bill Section**:
  - Input fields mimicking the physical bill (Opening Balance, Closing Stock, Guest Charge, Establishment Charge, Cook Charge).
  - A "Calculate" button that fetches DB stats (Purchase, Inmates, Points) and displays the final calculation view exactly like the image.
  - A button to "Save & Set Fee" for the term.
- **Mess Reports Section**:
  - Exact replica of the Committee's Daily/Monthly report views, but with a dropdown to select which 'Hostel Group' to view.

#### [MODIFY] frontend/js/admin.js
- Add corresponding JavaScript functions to handle the logic of the new sections (`loadBills`, `addBill`, `generateMessBill`, `loadMonthlyReports`, `loadDailyReports`).

## Open Questions
> [!QUESTION]
> - Should "Guest Charge" just be a manual input field on the mess bill generator, or does the system track guest meals separately? I will make it a manual input for now.manual
> - The physical bill has dates for "up to ____ 2025" for collecting fees with and without fines. Should I add input fields for these due dates when generating the bill so they are saved?yes 

## Verification Plan
1. Run the v6 migration.
2. Navigate to Admin Dashboard, add several shop bills for 'LHA&C' for the current month.
3. Use the "Generate Mess Bill" tool, enter the test data from the image to verify the calculation exactly matches (99 Rate, 50 Estt, 20 Cook).
4. Save the bill, log in as a student in that block, and verify their dashboard shows the correct total fee calculation.
5. Check the newly added Mess Reports section as Admin to see if student mess data is visible.

