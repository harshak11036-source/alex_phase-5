import { UserRole, MembershipStatus, DocumentStatus, DocumentType, AttendanceStatus, AssessmentType, AssignmentStatus, AchievementCategory, NotificationCategory, ProjectStatus, ProjectRole, MemoryCategory, AIProviderType } from '@prisma/client'

export type { UserRole, MembershipStatus, DocumentStatus, DocumentType, AttendanceStatus, AssessmentType, AssignmentStatus, AchievementCategory, NotificationCategory, ProjectStatus, ProjectRole, MemoryCategory, AIProviderType }

export interface UserWithMembership {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: UserRole
  isActive: boolean
  memberships: MembershipWithDetails[]
  activeMembership?: MembershipWithDetails
}

export interface MembershipWithDetails {
  id: string
  userId: string
  institutionId: string
  departmentId: string | null
  courseId: string | null
  semesterId: string | null
  academicYearId: string | null
  role: UserRole
  status: MembershipStatus
  studentId: string | null
  employeeId: string | null
  institution: Institution
  department: Department | null
  course: Course | null
  semester: Semester | null
  academicYear: AcademicYear | null
}

export interface Institution {
  id: string
  name: string
  code: string
  domain: string | null
  address: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
  settings: Record<string, unknown> | null
}

export interface Department {
  id: string
  name: string
  code: string
  institutionId: string
  description: string | null
}

export interface Course {
  id: string
  name: string
  code: string
  institutionId: string
  departmentId: string
  durationYears: number
  description: string | null
}

export interface AcademicYear {
  id: string
  name: string
  institutionId: string
  startDate: Date
  endDate: Date
  isActive: boolean
}

export interface Semester {
  id: string
  name: string
  number: number
  institutionId: string
  academicYearId: string
  courseId: string
  startDate: Date
  endDate: Date
  isActive: boolean
}

export interface SubjectWithRelations {
  id: string
  name: string
  code: string
  institutionId: string
  departmentId: string
  semesterId: string
  credits: number
  description: string | null
  syllabus: string | null
  textbooks: Record<string, unknown> | null
  institution: Institution
  department: Department
  semester: Semester
  lecturers: LecturerAssignmentWithUser[]
  resources: SubjectResource[]
  _count: {
    enrollments: number
    resources: number
  }
}

export interface LecturerAssignmentWithUser {
  id: string
  userId: string
  subjectId: string
  assignedAt: Date
  assignedBy: string | null
  isPrimary: boolean
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
  }
}

export interface SubjectResource {
  id: string
  subjectId: string
  title: string
  description: string | null
  category: string
  fileName: string
  storagePath: string
  fileSize: bigint
  mimeType: string
  version: number
  isPublished: boolean
  publishedAt: Date | null
  uploadedBy: string
  createdAt: Date
  updatedAt: Date
}

export interface DocumentWithRelations {
  id: string
  title: string
  description: string | null
  fileName: string
  fileSize: bigint
  mimeType: string
  documentType: DocumentType
  storagePath: string
  storageBucket: string
  checksum: string
  status: DocumentStatus
  errorMessage: string | null
  pageCount: number | null
  metadata: Record<string, unknown> | null
  ownerId: string
  subjectId: string | null
  projectId: string | null
  notebookId: string | null
  processorId: string | null
  processedAt: Date | null
  createdAt: Date
  updatedAt: Date
  owner: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  subject: SubjectWithRelations | null
  project: ProjectWithRelations | null
  _count: {
    chunks: number
  }
}

export interface ProjectWithRelations {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[]
  ownerId: string
  status: ProjectStatus
  startDate: Date | null
  endDate: Date | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  owner: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  members: ProjectMemberWithUser[]
  mentors: ProjectMentorWithUser[]
  _count: {
    tasks: number
    milestones: number
    documents: number
  }
}

export interface ProjectMemberWithUser {
  id: string
  projectId: string
  userId: string
  role: ProjectRole
  joinedAt: Date
  invitedBy: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
  }
}

export interface ProjectMentorWithUser {
  id: string
  projectId: string
  userId: string
  assignedAt: Date
  assignedBy: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
  }
}

export interface ConversationWithMessages {
  id: string
  title: string | null
  userId: string
  projectId: string | null
  notebookId: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  messages: Message[]
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  role: string
  content: string
  metadata: Record<string, unknown> | null
  toolCalls: Record<string, unknown> | null
  toolResults: Record<string, unknown> | null
  createdAt: Date
  sender: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
}

export interface TaskWithRelations {
  id: string
  title: string
  description: string | null
  assigneeId: string
  creatorId: string
  dueDate: Date | null
  completedAt: Date | null
  isCompleted: boolean
  priority: number
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  assignee: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  creator: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
}

export interface NotificationWithUser {
  id: string
  userId: string
  category: NotificationCategory
  title: string
  message: string
  referenceId: string | null
  referenceType: string | null
  isRead: boolean
  readAt: Date | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export interface AICredentialWithUser {
  id: string
  userId: string
  provider: AIProviderType
  providerName: string
  encryptedKey: string
  keyHash: string
  isActive: boolean
  isDefault: boolean
  models: Record<string, unknown> | null
  usageLimit: number | null
  usageCount: number
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AttendanceSessionWithRecords {
  id: string
  subjectId: string
  semesterId: string
  date: Date
  period: number
  topic: string | null
  conductedBy: string
  isCancelled: boolean
  createdAt: Date
  updatedAt: Date
  subject: SubjectWithRelations
  records: AttendanceRecord[]
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  userId: string
  status: AttendanceStatus
  markedBy: string
  markedAt: Date
  notes: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    firstName: string
    lastName: string
    studentId: string | null
    avatarUrl: string | null
  }
}

export interface AssessmentWithResults {
  id: string
  subjectId: string
  semesterId: string
  name: string
  type: AssessmentType
  maxMarks: number
  weight: number
  assessmentDate: Date
  description: string | null
  isPublished: boolean
  publishedAt: Date | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  subject: SubjectWithRelations
  results: AssessmentResult[]
}

export interface AssessmentResult {
  id: string
  assessmentId: string
  userId: string
  marksObtained: number
  feedback: string | null
  gradedBy: string | null
  gradedAt: Date | null
  isPublished: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    firstName: string
    lastName: string
    studentId: string | null
    avatarUrl: string | null
  }
}

export interface AssignmentWithSubmissions {
  id: string
  subjectId: string
  title: string
  description: string | null
  instructions: string | null
  maxMarks: number
  weight: number
  assignedDate: Date
  dueDate: Date
  allowedFormats: string[]
  allowResubmission: boolean
  maxSubmissions: number
  isPublished: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
  subject: SubjectWithRelations
  submissions: AssignmentSubmission[]
  attachments: AssignmentAttachment[]
}

export interface AssignmentAttachment {
  id: string
  assignmentId: string
  fileName: string
  storagePath: string
  fileSize: bigint
  mimeType: string
  createdAt: Date
}

export interface AssignmentSubmission {
  id: string
  assignmentId: string
  userId: string
  status: AssignmentStatus
  submissionNumber: number
  content: string | null
  submittedAt: Date | null
  gradedAt: Date | null
  marksObtained: number | null
  feedback: string | null
  gradedBy: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  attachments: SubmissionAttachment[]
}

export interface SubmissionAttachment {
  id: string
  submissionId: string
  fileName: string
  storagePath: string
  fileSize: bigint
  mimeType: string
  createdAt: Date
}

export interface StudentAchievement {
  id: string
  userId: string
  title: string
  category: AchievementCategory
  organization: string | null
  startDate: Date | null
  endDate: Date | null
  description: string | null
  status: string
  verificationStatus: string
  verifiedBy: string | null
  verifiedAt: Date | null
  certificateUrl: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface StudyMaterial {
  id: string
  userId: string
  title: string
  content: string
  type: string
  sourceDocId: string | null
  subjectId: string | null
  topic: string | null
  tags: string[]
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface FlashcardDeck {
  id: string
  userId: string
  title: string
  description: string | null
  subjectId: string | null
  sourceDocId: string | null
  algorithm: string
  createdAt: Date
  updatedAt: Date
  _count: {
    cards: number
  }
}

export interface Flashcard {
  id: string
  deckId: string
  front: string
  back: string
  difficulty: number
  interval: number
  repetitions: number
  easeFactor: number
  nextReview: Date
  lastReviewed: Date | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface MindMap {
  id: string
  userId: string
  title: string
  sourceDocId: string | null
  subjectId: string | null
  topic: string | null
  nodes: Record<string, unknown>
  edges: Record<string, unknown>
  viewport: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface Diagram {
  id: string
  userId: string
  title: string
  type: string
  sourceDocId: string | null
  subjectId: string | null
  definition: Record<string, unknown>
  renderedUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Quiz {
  id: string
  userId: string
  title: string
  description: string | null
  subjectId: string | null
  sourceDocId: string | null
  topic: string | null
  difficulty: string
  questions: Record<string, unknown>
  timeLimit: number | null
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

export interface QuizAttempt {
  id: string
  quizId: string
  userId: string
  answers: Record<string, unknown>
  score: number
  maxScore: number
  startedAt: Date
  completedAt: Date | null
  metadata: Record<string, unknown> | null
}

export interface GeneratedImage {
  id: string
  userId: string
  prompt: string
  sourceDocId: string | null
  subjectId: string | null
  imageUrl: string
  model: string
  parameters: Record<string, unknown> | null
  createdAt: Date
}

export interface ResearchNotebook {
  id: string
  title: string
  description: string | null
  ownerId: string
  projectId: string | null
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ResearchSource {
  id: string
  notebookId: string
  documentId: string | null
  title: string
  authors: Record<string, unknown> | null
  publicationYear: number | null
  doi: string | null
  url: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface ResearchNote {
  id: string
  notebookId: string
  userId: string
  title: string
  content: string
  sourceIds: string[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}