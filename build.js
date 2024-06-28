const rimraf = require('rimraf');
const ncp = require('ncp').ncp;
const path = require('path');
const fs = require('fs');

const distPath = path.join(__dirname, 'dist');
const modulePath = path.join(__dirname, 'module');
const langPath = path.join(__dirname, 'lang'); // Replace with your folder name
const filesToCopy = ['module.json', 'fu-roll-enhancements.mjs']; // Add your standalone files here

// Function to copy a folder
const copyFolder = (source, destination) => {
  return new Promise((resolve, reject) => {
    ncp(source, destination, err => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};

// Function to copy a file
const copyFile = (source, destination) => {
  return new Promise((resolve, reject) => {
    fs.copyFile(source, destination, err => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};

// Main function to handle the build process
const build = async () => {
  try {
    // Clear the /dist folder
    rimraf.sync(distPath);

    // Recreate the /dist folder
    fs.mkdirSync(distPath);

    // Copy the /module folder
    await copyFolder(modulePath, path.join(distPath, 'module'));

    // Copy the additional folder
    await copyFolder(langPath, path.join(distPath, 'lang'));

    // Copy standalone files
    for (const file of filesToCopy) {
      await copyFile(path.join(__dirname, file), path.join(distPath, file));
    }

    console.log('Build completed successfully!');
  } catch (err) {
    console.error('Build failed:', err);
  }
};

build();