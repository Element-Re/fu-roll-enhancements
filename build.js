const rimraf = require('rimraf');
const ncp = require('ncp').ncp;
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

const distPath = path.join(__dirname, 'dist');
const modulePath = path.join(__dirname, 'module');
const langPath = path.join(__dirname, 'lang');
const templatesPath = path.join(__dirname, 'templates');
const stylesPath = path.join(__dirname, 'styles');
const filesToCopy = ['module.json', 'fu-roll-enhancements.mjs'];

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


const build = async () => {
  try {

    // Clear and recreate /dist
    rimraf.sync(distPath);
    fs.mkdirSync(distPath);

    // Folders
    await copyFolder(modulePath, path.join(distPath, 'module'));
    await copyFolder(langPath, path.join(distPath, 'lang'));
    await copyFolder(templatesPath, path.join(distPath, 'templates'));
    await copyFolder(stylesPath, path.join(distPath, 'styles'));

    // Standalone files
    for (const file of filesToCopy) {
      await copyFile(path.join(__dirname, file), path.join(distPath, file));
    }

    console.log('Build completed successfully!');
  } catch (err) {
    console.error('Build failed:', err);
  }
};

const watchPaths = [modulePath, langPath, templatesPath, stylesPath, ...filesToCopy.map(file => path.join(__dirname, file))];

const startWatching = () => {
  chokidar.watch(watchPaths).on('change', (changed) => {
    console.log(`File ${path.basename(changed)} has been changed. Rebuilding...`);
    build();
  });
};

const args = process.argv.slice(2);
const watch = args.includes('--watch');

build().then(() => {
  if (watch) {
    startWatching();
    console.log('Watching for changes...');
  }
});