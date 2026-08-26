#!/usr/bin/env bash
# Scaffolds the ft_transcendence repo structure per CONTRIBUTING.md.
# Run this from the ROOT of your local ft_transcendence git clone.
set -e

echo "Creating directory structure..."
mkdir -p backend/config backend/apps
mkdir -p frontend/src frontend/public
mkdir -p docs
mkdir -p .github/workflows

# Placeholder READMEs so empty dirs are tracked by git
[ -f backend/README.md ] || echo "# Backend (Django 5 + DRF + Channels)" > backend/README.md
[ -f frontend/README.md ] || echo "# Frontend (React 18 + TypeScript)" > frontend/README.md
[ -f docs/README.md ] || echo "# Documentation index" > docs/README.md

echo ""
echo "Directory structure created:"
echo "  backend/"
echo "  frontend/"
echo "  docs/"
echo "  .github/workflows/"
echo ""

# Offer to move existing planning docs into docs/
if [ -d "Planing" ]; then
    echo "Found existing Planing/ folder."
    read -p "Move its contents into docs/ ? [y/N] " move_planning
    if [ "$move_planning" = "y" ] || [ "$move_planning" = "Y" ]; then
        cp -r Planing/* docs/
        echo "Copied Planing/ contents into docs/ (originals left in place — remove Planing/ manually once you've confirmed docs/ looks right)."
    fi
fi

if [ -f "Timeline.md" ]; then
    read -p "Move Timeline.md into docs/ ? [y/N] " move_timeline
    if [ "$move_timeline" = "y" ] || [ "$move_timeline" = "Y" ]; then
        cp Timeline.md docs/Timeline.md
        echo "Copied Timeline.md into docs/."
    fi
fi

echo ""
echo "Done. Review the changes with 'git status', then:"
echo "  git add ."
echo "  git commit -m \"chore: scaffold repo structure (backend/frontend/docs)\""
echo "  git push"
