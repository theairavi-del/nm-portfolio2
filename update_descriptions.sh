#!/bin/bash

# Extract and update project descriptions from nm_2

echo "Updating project descriptions..."

# Boreal
BOREAL_DESC="Boreal ski bindings is intentionally designed with a brutalist aesthetic, embodying safety, strength, and reliability. The angular, solid shape conveys a sense of protection and durability, ensuring you can trust these bindings on the toughest slopes."
sed -i '' "s|<p class=\"project-description\">.*</p>|<p class=\"project-description\">$BOREAL_DESC</p>|g" boreal.html

# Nestquest  
NESTQUEST_DESC=""

# Cognis
COGNIS_DESC=""

# Pawlish
PAWLISH_DESC=""

# OXA
OXA_DESC=""

# Sessio
SESSIO_DESC=""

# Mirage
MIRAGE_DESC=""

# Voiage
VOIAGE_DESC=""

# Peak
PEAK_DESC=""

echo "Done!"
