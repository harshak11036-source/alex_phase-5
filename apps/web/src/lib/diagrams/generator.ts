import { prisma } from '@/lib/prisma'
import { Diagram } from '@prisma/client'
import { Prisma } from '@prisma/client'

export type DiagramType = 'mermaid' | 'graphviz' | 'plantuml' | 'svg' | 'description'

export interface DiagramDefinition {
  type: DiagramType
  code: string
  title: string
  description?: string
}

export interface RenderedDiagram {
  svg: string
  width: number
  height: number
  type: DiagramType
}

export interface DiagramTemplate {
  id: string
  name: string
  category: string
  type: DiagramType
  code: string
  variables: Array<{ name: string; description: string; default?: string }>
}

export const diagramTemplates: DiagramTemplate[] = [
  {
    id: 'flowchart-basic',
    name: 'Basic Flowchart',
    category: 'General',
    type: 'mermaid',
    code: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
    variables: [
      { name: 'steps', description: 'Number of decision steps', default: '3' },
    ],
  },
  {
    id: 'sequence-diagram',
    name: 'Sequence Diagram',
    category: 'General',
    type: 'mermaid',
    code: `sequenceDiagram
    participant A as Actor
    participant S as System
    A->>S: Request
    S-->>A: Response`,
    variables: [
      { name: 'participants', description: 'Number of participants', default: '2' },
    ],
  },
  {
    id: 'er-diagram',
    name: 'Entity Relationship Diagram',
    category: 'Database',
    type: 'mermaid',
    code: `erDiagram
    STUDENT ||--o{ ENROLLMENT : "enrolls in"
    COURSE ||--o{ ENROLLMENT : "has"
    STUDENT {
      string id PK
      string name
      string email
    }
    COURSE {
      string id PK
      string code
      string name
    }
    ENROLLMENT {
      string student_id FK
      string course_id FK
      date enrolled_at
    }`,
    variables: [],
  },
  {
    id: 'class-diagram',
    name: 'UML Class Diagram',
    category: 'Software Engineering',
    type: 'mermaid',
    code: `classDiagram
    class Student {
      +id: string
      +name: string
      +email: string
      +enroll(course: Course): void
    }
    class Course {
      +id: string
      +code: string
      +name: string
      +addStudent(student: Student): void
    }
    Student "1" -- "*" Course : enrolls`,
    variables: [],
  },
  {
    id: 'state-diagram',
    name: 'State Diagram',
    category: 'General',
    type: 'mermaid',
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: start()
    Processing --> Success: complete()
    Processing --> Error: fail()
    Success --> [*]
    Error --> Idle: retry()`,
    variables: [],
  },
  {
    id: 'graphviz-dag',
    name: 'Directed Acyclic Graph',
    category: 'Graph Theory',
    type: 'graphviz',
    code: `digraph G {
    rankdir=LR;
    node [shape=box, style=filled, fillcolor=lightblue];
    A -> B;
    A -> C;
    B -> D;
    C -> D;
    D -> E;
}`,
    variables: [],
  },
  {
    id: 'mindmap',
    name: 'Mind Map',
    category: 'General',
    type: 'mermaid',
    code: `mindmap
  root((Central Topic))
    Branch 1
      Sub-branch 1.1
      Sub-branch 1.2
    Branch 2
      Sub-branch 2.1
      Sub-branch 2.2`,
    variables: [],
  },
  {
    id: 'git-graph',
    name: 'Git Branch Graph',
    category: 'Software Engineering',
    type: 'mermaid',
    code: `gitGraph
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit`,
    variables: [],
  },
  {
    id: 'timeline',
    name: 'Timeline',
    category: 'General',
    type: 'mermaid',
    code: `timeline
    title Project Timeline
    section Phase 1
      Task 1 : 2024-01-01 : 5d
      Task 2 : 2024-01-06 : 3d
    section Phase 2
      Task 3 : 2024-01-10 : 7d
      Task 4 : 2024-01-17 : 4d`,
    variables: [],
  },
  {
    id: 'plantuml-usecase',
    name: 'Use Case Diagram',
    category: 'Software Engineering',
    type: 'plantuml',
    code: `@startuml
actor Student
actor Teacher
usecase "Enroll in Course" as UC1
usecase "Grade Assignment" as UC2
Student --> UC1
Teacher --> UC2
@enduml`,
    variables: [],
  },
  {
    id: 'plantuml-component',
    name: 'Component Diagram',
    category: 'Software Engineering',
    type: 'plantuml',
    code: `@startuml
component "Web App" as Web
component "API" as API
component "Database" as DB
Web --> API
API --> DB
@enduml`,
    variables: [],
  },
]

export function getDiagramTemplates(): DiagramTemplate[] {
  return diagramTemplates
}

export function getDiagramTemplateById(id: string): DiagramTemplate | undefined {
  return diagramTemplates.find(t => t.id === id)
}

export function getDiagramTemplatesByCategory(category: string): DiagramTemplate[] {
  return diagramTemplates.filter(t => t.category === category)
}

export function getDiagramCategories(): string[] {
  return [...new Set(diagramTemplates.map(t => t.category))]
}

export async function renderMermaidToSvg(code: string): Promise<string> {
  // In production, use @mermaid-js/mermaid-cli or similar
  // For now, return a placeholder that can be rendered client-side
  return `<div class="mermaid">${code}</div>`
}

export async function renderGraphvizToSvg(code: string): Promise<string> {
  // In production, use @viz-js/viz or similar
  // For now, return a placeholder
  return `<div class="graphviz" data-code="${escapeHtml(code)}"></div>`
}

export async function renderPlantumlToSvg(code: string): Promise<string> {
  // In production, use plantuml-encoder or similar
  // For now, return a placeholder
  return `<div class="plantuml" data-code="${escapeHtml(code)}"></div>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;')
}

export async function generateDiagramFromTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<DiagramDefinition> {
  const template = getDiagramTemplateById(templateId)
  if (!template) {
    throw new Error(`Template not found: ${templateId}`)
  }

  let code = template.code
  for (const [key, value] of Object.entries(variables)) {
    code = code.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  return {
    type: template.type,
    code,
    title: template.name,
  }
}

export async function saveDiagram(
  userId: string,
  definition: DiagramDefinition,
  sourceDocId?: string,
  subjectId?: string
): Promise<Diagram> {
  return prisma.diagram.create({
    data: {
      userId,
      title: definition.title,
      type: definition.type,
      definition: definition as unknown as Prisma.InputJsonValue,
      sourceDocId,
      subjectId,
    },
  })
}

export async function getUserDiagrams(userId: string): Promise<Diagram[]> {
  return prisma.diagram.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteDiagram(diagramId: string, userId: string): Promise<void> {
  await prisma.diagram.deleteMany({
    where: { id: diagramId, userId },
  })
}