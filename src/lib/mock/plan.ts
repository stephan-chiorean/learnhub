import { Section } from "../../context/WalkthroughContext";

export const hardcodedPlan: Section[] = [
    {
      section: "Server Entrypoints and Initialization",
      sectionId: "server-entrypoints-and-initialization",
      description: [
        "The server entrypoints and initialization logic is the starting point of the application, setting up the server and defining the main routes.",
        "It's the backbone of the application, responsible for handling requests and responses.",
        "This part of the codebase interacts with the workspace helpers to manage workspaces."
      ],
      files: [
        "server/index.ts",
        "server/workspaces/workspaceHelpers.ts"
      ]
    },
    {
      section: "Context Injection",
      sectionId: "context-injection",
      description: [
        "The Context Injection domain is responsible for providing and managing global state within the application.",
        "It's a crucial part of the application architecture, allowing components to access and modify shared state.",
        "The WorkspaceContext, for example, likely manages the state of the user's workspace."
      ],
      files: [
        "src/context/WorkspaceContext.tsx"
      ]
    },
    {
      section: "UI Views",
      sectionId: "ui-views",
      description: [
        "The UI Views domain is where the user interface of the application is defined.",
        "It includes the main layout of the application, as well as key views such as the CodeViewer, Workspace, and various modals.",
        "These components interact with the Context Injection domain to access and modify shared state."
      ],
      files: [
        "src/App.tsx",
        "src/components/MainContent.tsx",
        "src/components/CodeViewer.tsx",
        "src/components/Workspace.tsx",
        "src/components/AnnotationModal.tsx",
        "src/components/AnnotationsSidebar.tsx",
        "src/components/ChatModal.tsx",
        "src/components/AISummaryModal.tsx",
        "src/components/WalkthroughModal.tsx",
        "src/components/Notepad.tsx",
        "src/components/Sidebar.tsx"
      ]
    },
    {
      section: "Utility Functions",
      sectionId: "utility-functions",
      description: [
        "The Utility Functions domain includes helper functions and custom hooks that are used across the application.",
        "These functions provide reusable logic that can be used by multiple components.",
        "For example, the useSidebar hook likely provides logic related to the sidebar state and interactions."
      ],
      files: [
        "src/hooks/useSidebar.ts",
        "src/lib/utils.ts",
        "src/utils/languageDetector.ts"
      ]
    },
    {
      section: "UI Components",
      sectionId: "ui-components",
      description: [
        "The UI Components domain includes reusable UI components that are used across the application.",
        "These components are smaller, more generic parts of the UI, such as buttons, cards, and dialogs.",
        "They are used within the UI Views to construct the user interface."
      ],
      files: [
        "src/components/ui/button.tsx",
        "src/components/ui/card.tsx",
        "src/components/ui/dialog.tsx",
        "src/components/ui/dropdown-menu.tsx",
        "src/components/ui/label.tsx",
        "src/components/ui/scroll-area.tsx",
        "src/components/ui/textarea.tsx",
        "src/components/ui/tooltip.tsx"
      ]
    },
    {
      section: "Documentation",
      sectionId: "documentation",
      description: [
        "The Documentation domain includes the README file, which provides an overview of the project and instructions for setup and usage.",
        "It's an important resource for new developers joining the project, as it provides context and guidance."
      ],
      files: [
        "README.md"
      ]
    }
  ];