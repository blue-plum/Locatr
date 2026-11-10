# Changelog

## 1.1.0

- Rebrand the app as Locatr, with the supplied logo and "Where everything belongs" tagline.
- Update the interface to a blue colour scheme and label download names to Locatr.
- Preserve existing storage IDs, QR URLs, database format and Compose service/volume settings for Arcane redeployment.

## 1.0.2

- Add Raspberry Pi Docker Compose deployment instructions for the private GitHub repository.
- Configure the host port and QR destination through a local `.env` file.
- Add a container health check, bounded logs and persistent-volume backup instructions.

## 1.0.1

- Organise deployment configuration and preview images into dedicated folders.
- Add a repeatable release builder with versioned ZIP filenames.
- Keep local data, dependencies, caches and generated releases outside Git.
- Record the working app in Git with version tags.

## 1.0.0

- Household storage and item inventory, photographs, locations and types.
- Search, responsive views, editable lists and safe deletion of unused list entries.
- Custom SVG/PNG QR labels and Avery sheet printing.
- StoTrak branding and refined navigation layout.
