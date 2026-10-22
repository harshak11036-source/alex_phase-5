export enum UserRole {
  STUDENT = 'STUDENT',
  LECTURER = 'LECTURER',
  PROJECT_MENTOR = 'PROJECT_MENTOR',
  ADMIN = 'ADMIN',
}

export enum MembershipStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  QUEUED = 'QUEUED',
  EXTRACTING = 'EXTRACTING',
  CHUNKING = 'CHUNKING',
  EMBEDDING = 'EMBEDDING',
  INDEXING = 'INDEXING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum DocumentType {
  PDF = 'PDF',
  DOC = 'DOC',
  DOCX = 'DOCX',
  TXT = 'TXT',
  MARKDOWN = 'MARKDOWN',
  CSV = 'CSV',
  XLS = 'XLS',
  XLSX = 'XLSX',
  PPT = 'PPT',
  PPTX = 'PPTX',
  PNG = 'PNG',
  JPG = 'JPG',
  JPEG = 'JPEG',
  OTHER = 'OTHER',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
  ON_DUTY = 'ON_DUTY',
}

export enum AssessmentType {
  INTERNAL_ASSESSMENT = 'INTERNAL_ASSESSMENT',
  ASSIGNMENT = 'ASSIGNMENT',
  QUIZ = 'QUIZ',
  LAB_ASSESSMENT = 'LAB_ASSESSMENT',
  PROJECT = 'PROJECT',
  PRESENTATION = 'PRESENTATION',
  PRACTICAL_EXAM = 'PRACTICAL_EXAM',
  SEMESTER_EXAM = 'SEMESTER_EXAM',
  OTHER = 'OTHER',
}

export enum AssignmentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  LATE = 'LATE',
  RESUBMITTED = 'RESUBMITTED',
  EVALUATED = 'EVALUATED',
  PUBLISHED = 'PUBLISHED',
}

export enum AchievementCategory {
  INTERNSHIP = 'INTERNSHIP',
  CERTIFICATION = 'CERTIFICATION',
  WORKSHOP = 'WORKSHOP',
  HACKATHON = 'HACKATHON',
  RESEARCH_PUBLICATION = 'RESEARCH_PUBLICATION',
  TECHNICAL_COMPETITION = 'TECHNICAL_COMPETITION',
  CLUB_ACTIVITY = 'CLUB_ACTIVITY',
  VOLUNTEERING = 'VOLUNTEERING',
  PROJECT = 'PROJECT',
  AWARD = 'AWARD',
  PLACEMENT_PREPARATION = 'PLACEMENT_PREPARATION',
  OTHER = 'OTHER',
}

export enum NotificationCategory {
  ASSIGNMENT = 'ASSIGNMENT',
  ATTENDANCE = 'ATTENDANCE',
  INTERNAL_ASSESSMENT = 'INTERNAL_ASSESSMENT',
  ACADEMIC_ANNOUNCEMENT = 'ACADEMIC_ANNOUNCEMENT',
  PROJECT_MILESTONE = 'PROJECT_MILESTONE',
  MENTOR_FEEDBACK = 'MENTOR_FEEDBACK',
  RESEARCH_UPDATE = 'RESEARCH_UPDATE',
  STUDY_REMINDER = 'STUDY_REMINDER',
  UPCOMING_DEADLINE = 'UPCOMING_DEADLINE',
  DOCUMENT_PROCESSING_FAILURE = 'DOCUMENT_PROCESSING_FAILURE',
  AI_TASK_COMPLETION = 'AI_TASK_COMPLETION',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProjectRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
  MENTOR = 'MENTOR',
}

export enum MemoryCategory {
  CONVERSATION_HISTORY = 'CONVERSATION_HISTORY',
  EXPLICIT_MEMORIES = 'EXPLICIT_MEMORIES',
  ACADEMIC_CONTEXT = 'ACADEMIC_CONTEXT',
  PROJECT_CONTEXT = 'PROJECT_CONTEXT',
  RETRIEVED_KNOWLEDGE = 'RETRIEVED_KNOWLEDGE',
}

export enum AIProviderType {
  NVIDIA_NEMOTRON = 'NVIDIA_NEMOTRON',
  OPENAI = 'OPENAI',
  GOOGLE_GEMINI = 'GOOGLE_GEMINI',
  ANTHROPIC = 'ANTHROPIC',
  MISTRAL = 'MISTRAL',
  GROQ = 'GROQ',
  OPENROUTER = 'OPENROUTER',
  TOGETHER_AI = 'TOGETHER_AI',
  OTHER = 'OTHER',
}

export interface Institution {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  institutionId: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  institutionId: string;
  departmentId: string;
  durationYears: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademicYear {
  id: string;
  name: string;
  institutionId: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Semester {
  id: string;
  name: string;
  number: number;
  institutionId: string;
  academicYearId: string;
  courseId: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  emailVerified: Date | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollegeMembership {
  id: string;
  userId: string;
  institutionId: string;
  departmentId: string | null;
  courseId: string | null;
  semesterId: string | null;
  academicYearId: string | null;
  role: UserRole;
  status: MembershipStatus;
  studentId: string | null;
  employeeId: string | null;
  enrolledAt: Date;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipWithDetails extends CollegeMembership {
  institution: Institution;
  department: Department | null;
  course: Course | null;
  semester: Semester | null;
  academicYear: AcademicYear | null;
}

export interface UserWithMembership extends User {
  memberships: MembershipWithDetails[];
  activeMembership?: MembershipWithDetails;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  institutionId: string;
  departmentId: string;
  semesterId: string;
  credits: number;
  description: string | null;
  syllabus: string | null;
  textbooks: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectWithRelations extends Subject {
  institution: Institution;
  department: Department;
  semester: Semester;
  lecturers: LecturerAssignmentWithUser[];
  resources: SubjectResource[];
  _count: {
    enrollments: number;
    resources: number;
  };
}

export interface LecturerAssignmentWithUser {
  id: string;
  userId: string;
  subjectId: string;
  assignedAt: Date;
  assignedBy: string | null;
  isPrimary: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface SubjectResource {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  storagePath: string;
  fileSize: bigint;
  mimeType: string;
  version: number;
  isPublished: boolean;
  publishedAt: Date | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: bigint;
  mimeType: string;
  documentType: DocumentType;
  storagePath: string;
  storageBucket: string;
  checksum: string;
  status: DocumentStatus;
  errorMessage: string | null;
  pageCount: number | null;
  metadata: Record<string, unknown> | null;
  ownerId: string;
  subjectId: string | null;
  projectId: string | null;
  notebookId: string | null;
  processorId: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentWithRelations extends Document {
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  subject: SubjectWithRelations | null;
  project: ProjectWithRelations | null;
  _count: {
    chunks: number;
  };
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  ownerId: string;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithRelations extends Project {
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  members: ProjectMemberWithUser[];
  mentors: ProjectMentorWithUser[];
  _count: {
    tasks: number;
    milestones: number;
    documents: number;
  };
}

export interface ProjectMemberWithUser {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
  invitedBy: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface ProjectMentorWithUser {
  id: string;
  projectId: string;
  userId: string;
  assignedAt: Date;
  assignedBy: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface Conversation {
  id: string;
  title: string | null;
  userId: string;
  projectId: string | null;
  notebookId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  toolCalls: Record<string, unknown> | null;
  toolResults: Record<string, unknown> | null;
  createdAt: Date;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  creatorId: string;
  dueDate: Date | null;
  completedAt: Date | null;
  isCompleted: boolean;
  priority: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskWithRelations extends Task {
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface Notification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  referenceId: string | null;
  referenceType: string | null;
  isRead: boolean;
  readAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AICredential {
  id: string;
  userId: string;
  provider: AIProviderType;
  providerName: string;
  encryptedKey: string;
  keyHash: string;
  isActive: boolean;
  isDefault: boolean;
  models: Record<string, unknown> | null;
  usageLimit: number | null;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceSession {
  id: string;
  subjectId: string;
  semesterId: string;
  date: Date;
  period: number;
  topic: string | null;
  conductedBy: string;
  isCancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceSessionWithRecords extends AttendanceSession {
  subject: SubjectWithRelations;
  records: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  userId: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string | null;
    avatarUrl: string | null;
  };
}

export interface Assessment {
  id: string;
  subjectId: string;
  semesterId: string;
  name: string;
  type: AssessmentType;
  maxMarks: number;
  weight: number;
  assessmentDate: Date;
  description: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentWithResults extends Assessment {
  subject: SubjectWithRelations;
  results: AssessmentResult[];
}

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  userId: string;
  marksObtained: number;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: Date | null;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string | null;
    avatarUrl: string | null;
  };
}

export interface Assignment {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  maxMarks: number;
  weight: number;
  assignedDate: Date;
  dueDate: Date;
  allowedFormats: string[];
  allowResubmission: boolean;
  maxSubmissions: number;
  isPublished: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentWithSubmissions extends Assignment {
  subject: SubjectWithRelations;
  submissions: AssignmentSubmission[];
  attachments: AssignmentAttachment[];
}

export interface AssignmentAttachment {
  id: string;
  assignmentId: string;
  fileName: string;
  storagePath: string;
  fileSize: bigint;
  mimeType: string;
  createdAt: Date;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  userId: string;
  status: AssignmentStatus;
  submissionNumber: number;
  content: string | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
  marksObtained: number | null;
  feedback: string | null;
  gradedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  attachments: SubmissionAttachment[];
}

export interface SubmissionAttachment {
  id: string;
  submissionId: string;
  fileName: string;
  storagePath: string;
  fileSize: bigint;
  mimeType: string;
  createdAt: Date;
}

export interface StudentAchievementType {
  id: string;
  userId: string;
  title: string;
  category: AchievementCategory;
  organization: string | null;
  startDate: Date | null;
  endDate: Date | null;
  description: string | null;
  status: string;
  verificationStatus: string;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  certificateUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudyMaterialType {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: string;
  sourceDocId: string | null;
  subjectId: string | null;
  topic: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardDeck {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  sourceDocId: string | null;
  algorithm: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    cards: number;
  };
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  difficulty: number;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReview: Date;
  lastReviewed: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MindMap {
  id: string;
  userId: string;
  title: string;
  sourceDocId: string | null;
  subjectId: string | null;
  topic: string | null;
  nodes: Record<string, unknown>;
  edges: Record<string, unknown>;
  viewport: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Diagram {
  id: string;
  userId: string;
  title: string;
  type: string;
  sourceDocId: string | null;
  subjectId: string | null;
  definition: Record<string, unknown>;
  renderedUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quiz {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  sourceDocId: string | null;
  topic: string | null;
  difficulty: string;
  questions: Record<string, unknown>;
  timeLimit: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: Record<string, unknown>;
  score: number;
  maxScore: number;
  startedAt: Date;
  completedAt: Date | null;
  metadata: Record<string, unknown> | null;
}

export interface GeneratedImage {
  id: string;
  userId: string;
  prompt: string;
  sourceDocId: string | null;
  subjectId: string | null;
  imageUrl: string;
  model: string;
  parameters: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ResearchNotebook {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  projectId: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchSource {
  id: string;
  notebookId: string;
  documentId: string | null;
  title: string;
  authors: Record<string, unknown> | null;
  publicationYear: number | null;
  doi: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchNote {
  id: string;
  notebookId: string;
  userId: string;
  title: string;
  content: string;
  sourceIds: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GuardianContact {
  id: string;
  institutionId: string;
  studentId: string;
  name: string;
  relationship: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
  consentGiven: boolean;
  consentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  institutionId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  category: NotificationCategory;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationConfig {
  id: string;
  institutionId: string;
  provider: string;
  providerConfig: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  provider: string;
  recipient: string;
  status: string;
  providerResponse: Record<string, unknown> | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AIModelConfig {
  id: string;
  userId: string;
  provider: AIProviderType;
  modelId: string;
  taskType: string;
  isDefault: boolean;
  parameters: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  sectionTitle: string | null;
  tokenCount: number;
  embedding: Buffer | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface DocumentProcessingJob {
  id: string;
  documentId: string;
  step: string;
  status: DocumentStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  fileName: string;
  fileSize: bigint;
  storagePath: string;
  checksum: string;
  createdBy: string;
  createdAt: Date;
}

export interface SubjectEnrollment {
  id: string;
  userId: string;
  subjectId: string;
  semesterId: string;
  enrolledAt: Date;
  isActive: boolean;
}

export interface LecturerAssignment {
  id: string;
  userId: string;
  subjectId: string;
  assignedAt: Date;
  assignedBy: string | null;
  isPrimary: boolean;
}

export interface PlannerEvent {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  eventType: string;
  subjectId: string | null;
  taskId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMemory {
  id: string;
  userId: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  source: string | null;
  isVerified: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}