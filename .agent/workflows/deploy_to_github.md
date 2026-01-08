---
description: How to host your ImagiStory app on GitHub and GitHub Pages
---

Follow these steps to upload your project to GitHub and make it live for the world to see!

## 1. Initialize Git Locally
Open your terminal in the project directory (`c:/Users/Vaibhav Verma/Documents/VV-Plak/WB/Img_Story`) and run:
```powershell
git init
git add .
git commit -m "Initial commit: Interactive Story Generator"
```

## 2. Create a GitHub Repository
1. Go to [GitHub](https://github.com/new) and log in.
2. Name your repository (e.g., `imagistory`).
3. Keep it **Public**.
4. Click **Create repository**.

## 3. Link Local to Remote
Copy the commands from the "or push an existing repository from the command line" section on GitHub:
```powershell
git remote add origin https://github.com/YOUR_USERNAME/imagistory.git
git branch -M main
git push -u origin main
```
*(Replace `YOUR_USERNAME` with your actual GitHub username)*

## 4. Enable GitHub Pages (To make it live)
1. On your GitHub repository page, go to **Settings** (top tab).
2. Click **Pages** in the left sidebar.
3. Under **Build and deployment > Branch**, select `main` and `/root`.
4. Click **Save**.
5. Wait a minute, and your site will be live at: `https://YOUR_USERNAME.github.io/imagistory/`

## 5. Add to Profile
To show it off on your profile:
1. Go to your GitHub profile.
2. Click **Edit profile** (if you want to add a link in bio).
3. Or "Pin" the repository so it's the first thing people see!
