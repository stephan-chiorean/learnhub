class FileMetadata {
  filePath string @description("Path to the source code file")
}

class PlanSection {
  section string @description("Title of the domain section")
  description string[] @description("Bullet points explaining the domain")
  files string[] @description("Relevant file paths for this section")
}

function GenerateCodeWalkthrough(fileList: FileMetadata[]) -> PlanSection[] {
  client "openai/gpt-4o"
  prompt #"
    You are an expert course planner. Given the list of files below, create a structured walkthrough plan grouped into logical implementation domains based on how the project works.

    Group by responsibilities and functionality, NOT folders or filenames. Order sections to reflect natural learning flow:
    - Server entrypoints and initialization
    - API and integration layers
    - Internal and shared logic
    - Data access and domain logic
    - Frontend entrypoints and major views
    - Infrastructure, tooling, and tests

    Focus on creating clear "checkpoints" that show the major domains and logical flow. Write descriptions as if an experienced engineer is explaining the system to a peer.

    {{ ctx.output_format }}

    {{ _.role("user") }} Files to analyze:
    {% for file in fileList %}
    File: {{ file.filePath }}
    {% endfor %}
  "#
}

test BasicFileList {
  functions [GenerateCodeWalkthrough]
  args {
    fileList [
      {
        filePath "src/server.ts"
      },
      {
        filePath "src/api/users.ts"
      },
      {
        filePath "src/components/Dashboard.tsx"
      }
    ]
  }
}

test ComplexFileList {
  functions [GenerateCodeWalkthrough]
  args {
    fileList [
      {
        filePath "src/index.ts"
      },
      {
        filePath "src/api/auth.ts"
      },
      {
        filePath "src/api/projects.ts"
      },
      {
        filePath "src/db/models/user.ts"
      },
      {
        filePath "src/components/Layout.tsx"
      },
      {
        filePath "tests/api.test.ts"
      }
    ]
  }
}