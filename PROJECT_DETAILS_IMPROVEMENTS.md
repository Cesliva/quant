# Project Details Page Improvements - UI/UX & Steel Estimator Analysis

## Missing Critical Elements

### From UI/UX Designer Perspective:
1. **Form Organization**: Fields are flat - need logical grouping (Basic Info, Dates, Specifications, etc.)
2. **Required Field Indicators**: No visual indication of required vs optional fields
3. **Form Validation**: No real-time validation or error messages
4. **Navigation**: Missing Cancel/Back button, breadcrumb navigation
5. **Auto-save**: No indication of save status or auto-save functionality
6. **Help Text**: No guidance or tooltips for complex fields
7. **Related Actions**: Missing duplicate, archive, delete, or export options
8. **Status Indicator**: No visual status badge or project state
9. **Form Sections**: Should be collapsible/expandable for better organization
10. **Save Feedback**: No confirmation or success message

### From Steel Estimator Perspective:
1. **Project Status**: Missing Draft, Active, Submitted, Won, Lost status
2. **Project Number**: No unique project identifier/code
3. **Owner/Client**: Only has GC, but need end customer info
4. **Location/Address**: Critical for material delivery and logistics
5. **Project Type**: Structural, Misc Metals, Bridge, Stairs, etc.
6. **Delivery Date**: Separate from bid date - when project needs to be completed
7. **Decision Date**: When will we hear back about the bid
8. **Probability of Win**: Percentage estimate for pipeline management
9. **Estimated Value**: Budget range or estimated project value
10. **Competition Level**: Low, Medium, High - affects bidding strategy
11. **Contact Information**: GC contact person, phone, email
12. **Notes/Description**: Important project details, special requirements
13. **Multiple Spec Divisions**: Not just 05 and 09 - need ability to add more
14. **Custom Spec Divisions**: Ability to add project-specific divisions
15. **Project Template**: Show which template was used (if any)
16. **Timestamps**: Created date, last modified, last accessed
17. **Related Documents**: Link to specs, drawings, RFIs
18. **Project Tags**: Categories for filtering and organization

## Recommended Improvements

### Priority 1 (Critical):
- **Project Status** selector (Draft, Active, Submitted, Won, Lost)
- **Project Number** field (auto-generated or manual)
- **Owner/Client** field (separate from GC)
- **Location/Address** field
- **Delivery Date** (separate from bid date)
- **Form Sections** (Basic Info, Dates & Deadlines, Specifications, Contacts)
- **Required Field Indicators** (asterisks)
- **Cancel/Back Navigation**

### Priority 2 (Important):
- **Decision Date** field
- **Probability of Win** slider/percentage
- **Estimated Value** field
- **Competition Level** selector
- **Contact Information** section (GC contact details)
- **Notes/Description** textarea
- **Multiple Spec Divisions** (add/remove dynamically)
- **Save Confirmation** feedback

### Priority 3 (Nice to Have):
- **Auto-save** functionality
- **Related Documents** section
- **Project Tags** for categorization
- **Timestamps** (created, modified)
- **Duplicate Project** action
- **Archive/Delete** actions
- **Form Validation** with helpful messages

