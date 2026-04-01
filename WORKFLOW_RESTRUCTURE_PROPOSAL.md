# Workflow Restructure Proposal

## Narrative
Every day at 8:00 am, use the AI agent to check employee's training, documentation, and attendance data and output whether each is compliant or not. A widget on the homepage should be updated based on the findings in this agent.

## Current Structure
```
Trigger (Every business day at 8:00 am)
  ↓
AI Agent (Health check)
  ↓
SMS Step
  ↓
End
```

## Proposed Structure

### 1. **Trigger Step** ✅ (Already Updated)
- **Name**: "Every business day at 8:00 am"
- **Type**: Scheduled trigger
- **Status**: Already implemented

### 2. **Data Sources Needed**

The trigger should provide access to employee data in three categories:

#### A. **Training Data** (New - needs to be added)
```
Employee
  └── Training
      ├── Training completion status
      ├── Required trainings completed
      ├── Training expiration dates
      ├── Certification status
      └── Last training date
```

#### B. **Documentation Data** (Partially exists)
```
Employee
  └── Documentation
      ├── Required documents on file
      ├── Document expiration dates
      ├── Document compliance status
      └── Missing documents
```

#### C. **Attendance Data** (New - needs to be added)
```
Employee
  └── Attendance
      ├── Recent attendance rate
      ├── Absences this period
      ├── Tardiness count
      ├── Compliance threshold
      └── Attendance status
```

### 3. **AI Agent Step** (Health check)

#### Input Configuration:
- **Prompt**: Should reference all three data categories
- **Example prompt structure**:
  ```
  Review the following employee data and determine compliance status:
  
  Training Data:
  - Training completion: {{Employee.Training.Training completion status}}
  - Required trainings: {{Employee.Training.Required trainings completed}}
  - Expiration dates: {{Employee.Training.Training expiration dates}}
  
  Documentation Data:
  - Documents on file: {{Employee.Documentation.Required documents on file}}
  - Expiration dates: {{Employee.Documentation.Document expiration dates}}
  
  Attendance Data:
  - Attendance rate: {{Employee.Attendance.Recent attendance rate}}
  - Absences: {{Employee.Attendance.Absences this period}}
  - Tardiness: {{Employee.Attendance.Tardiness count}}
  
  For each category (Training, Documentation, Attendance), determine if the employee is compliant or non-compliant based on company policies.
  ```

#### Output Format: **JSON** (Recommended)
```json
{
  "trainingCompliance": {
    "status": "compliant" | "non-compliant",
    "details": "string",
    "issues": ["array of issues if non-compliant"]
  },
  "documentationCompliance": {
    "status": "compliant" | "non-compliant",
    "details": "string",
    "issues": ["array of issues if non-compliant"]
  },
  "attendanceCompliance": {
    "status": "compliant" | "non-compliant",
    "details": "string",
    "issues": ["array of issues if non-compliant"]
  },
  "overallStatus": "compliant" | "non-compliant" | "partial",
  "summary": "string"
}
```

This JSON structure would create variables like:
- `Health check > Health check output > trainingCompliance.status`
- `Health check > Health check output > trainingCompliance.details`
- `Health check > Health check output > documentationCompliance.status`
- `Health check > Health check output > attendanceCompliance.status`
- `Health check > Health check output > overallStatus`
- `Health check > Health check output > summary`

### 4. **Homepage Widget Update Step** (New)

Instead of SMS, add a step to update a homepage widget:

```
AI Agent (Health check)
  ↓
Update Homepage Widget
  ↓
End
```

#### Widget Update Step:
- **Type**: Database/API update action
- **Purpose**: Store compliance results for homepage display
- **Input**: Use variables from Health check output
- **Configuration**:
  - Widget ID/Name
  - Update frequency
  - Data mapping from AI agent output

### 5. **Recommended Workflow Structure**

```
┌─────────────────────────────────────┐
│  Trigger: Every business day 8:00am │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  AI Agent: Health check              │
│  - Input: Training, Documentation,   │
│    Attendance data                    │
│  - Output: Compliance status (JSON)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Update Homepage Widget              │
│  - Store compliance results           │
│  - Update widget display              │
└──────────────┬──────────────────────┘
               │
               ▼
            [End]
```

## Implementation Steps

### Step 1: Add Data Categories to Trigger Variables
- Add "Training" category to Employee object in `lib/variables.ts`
- Add "Documentation" category (enhance existing)
- Add "Attendance" category to Employee object

### Step 2: Update AI Agent Prompt
- Modify default prompt to reference all three data categories
- Set output format to JSON
- Configure JSON schema with compliance fields

### Step 3: Replace SMS Step with Widget Update Step
- Remove SMS step from workflow
- Add new "Update Widget" step type
- Configure widget update action

### Step 4: Update Homepage
- Create widget component that displays compliance status
- Connect widget to stored compliance data
- Display training, documentation, and attendance compliance

## Benefits of This Structure

1. **Clear Data Flow**: Trigger → Data Collection → Analysis → Action
2. **Structured Output**: JSON format enables easy widget integration
3. **Scalable**: Easy to add more compliance categories
4. **Actionable**: Widget provides immediate visibility into compliance status
5. **Automated**: Fully automated daily health checks

## Alternative: Keep SMS for Alerts

If you want to keep notifications, you could have:
```
Trigger → AI Agent → [Branch]
                      ├─→ Update Widget (always)
                      └─→ Send SMS (only if non-compliant)
```

This would alert stakeholders when issues are found while still updating the widget.
