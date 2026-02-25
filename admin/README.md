# Nico Maggioli Portfolio - Admin Guide

## 🎨 Content Management System

I've created a simple admin interface for you to edit your portfolio without touching code!

### Accessing the Admin Panel

1. Go to: `https://nicomaggioli.com/admin/`
2. You'll see all your projects listed
3. Click "Edit" to modify any project
4. Click "+ Add Project" to create new ones

### What You Can Edit

For each project, you can change:
- **Title** - Project name
- **Description** - Brief description
- **Category** - Type of work (e.g., "Brand Identity")
- **Year** - When it was done
- **Hero Image Path** - Path to the project image
- **Project Link** - URL to the project page

### How to Add Images

1. Upload your image to the `media/` folder (or a subfolder like `media/projectname/`)
2. In the admin, set the Hero Image Path to: `../media/yourimage.png`

### Important Notes

- Changes are saved to your browser's local storage
- To make changes permanent on the live site, you'll need to export the data and update the `data/projects.json` file
- The admin panel works best on desktop

### Future Improvements

Want me to add:
- [ ] Direct image upload (drag & drop)
- [ ] Reorder projects (drag to rearrange)
- [ ] Preview mode (see changes before saving)
- [ ] More fields (client name, link URL, etc.)

Let me know what would make this more useful for you!
