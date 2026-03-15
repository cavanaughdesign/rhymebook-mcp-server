# RhymeBook Quick Start Guide

## For Artists Using RhymeBook

### Getting Started
1. Make sure the RhymeBook MCP server is running
2. Start a conversation with Claude
3. Just ask naturally - Claude will use the right tools!

### Example Prompts

#### Writing Lyrics
- "Find rhymes for 'dream'"
- "Count syllables in this line: ..."
- "Analyze the flow of my verse"
- "Save my lyrics for 'Midnight Dreams'"

#### Recording Sessions
- "Create a new song called 'Summer Vibes'"
- "Schedule a recording session for tomorrow at SoundWave Studios"
- "Log take 3 - 5 stars, perfect take!"
- "Add note: Need to re-record the bridge"

#### Finding Beats
- "Show me trap beats around 140 BPM"
- "Find a beat that matches these lyrics"
- "What's in my beat library?"
- "Mark 'Street Dreams' as favorite"

#### Project Management
- "Show my project dashboard"
- "What's my progress on 'Summer Vibes'?"
- "Update status to recording"
- "Show recent activity"

## For Developers

### Installing the Skill

#### Option 1: Project Skill (Recommended)
The skill is already in `.claude/skills/SKILL.md` in your project. Claude will automatically detect it when working in this folder.

#### Option 2: Global Skill
Copy the skill to your global Claude skills folder:
```bash
# Windows
copy .claude\skills\SKILL.md %USERPROFILE%\.claude\skills\rhymebook.md

# macOS/Linux
cp .claude/skills/SKILL.md ~/.claude/skills/rhymebook.md
```

### Skill Structure
```
.claude/
└── skills/
    ├── SKILL.md              # Main skill instructions
    └── references/
        ├── tool-reference.md # All tool parameters
        └── quick-start.md    # This file
```

### How It Works
1. Claude detects keywords in your prompt (rhyme, lyric, beat, etc.)
2. Loads the RhymeBook skill automatically
3. Uses the decision tree to pick the right tool
4. Executes the tool and presents results

### Customizing the Skill
Edit `.claude/skills/SKILL.md` to:
- Add new workflows
- Customize response formats
- Add project-specific instructions

## Troubleshooting

### Skill Not Activating
- Check that `.claude/skills/SKILL.md` exists
- Verify the description contains relevant trigger words
- Try using explicit keywords like "rhyme", "beat", "lyrics"

### Tools Not Found
- Ensure the RhymeBook MCP server is running
- Check your MCP configuration in VS Code or Claude Desktop
- Verify the server path is correct

### Connection Issues
- Check that the server is running: `npm start`
- Verify the port (default: 3001)
- Check for error messages in the terminal
