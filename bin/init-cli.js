#! /usr/bin/env node


const program = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const shell = require('shelljs');
const inquirer = require('inquirer');
const ora = require('ora');
const ejs = require('ejs');
const path = require('path');
const currentPath = process.cwd();
let answersConfig = null;

program
  .version(require('../package.json').version)
  .usage('<command> [options]')
  .option('-F, --force', '强制覆盖同名文件夹');

program
  .command('init <项目路径> [选项]')
  .description('指令说明：初始化项目')
  .action(async (appName) => {
    try {
      let targetDir = path.resolve(currentPath, appName || '.');
      if (fs.pathExistsSync(targetDir)) {
        if (program.force) {
          GenarateProject(appName);
        }
        ora(chalk.red(`！当前目录下，${appName}已存在，请修改名称后重试`)).fail();
        process.exit(1);
      };
      answersConfig = await getAnswers(appName);
      GenarateProject(appName);
    } catch (error) {
      ora(chalk.red(`项目创建失败：${error}`)).fail();
      process.exit(1);
    }
  });

function getAnswers(appName) {
  const options = [
    {
      type: 'input',
      name: 'name',
      message: '项目名称',
      default: appName,
    },
    {
      type: 'input',
      name: 'description',
      message: '项目描述',
      default: '单页面应用',
    },
    {
      type: 'confirm',
      name: 'eslint',
      message: '是否启用 eslint+pretty',
      default: true
    },
    {
      name: 'cssPreprocessor',
      type: 'list',
      message: 'CSS 预处理器',
      choices: [
        "less",
        "sass",
        "none",
      ]
    },
    {
      name: 'template',
      type: 'list',
      message: '选取模板',
      choices: [
        "react-ssr-project",
      ]
    },
  ];
  return inquirer.prompt(options);
}


function DownTemplate(projectDir) {
  const remote = 'https://github.com/jinyingmo/react-ssr-project.git';
  const { template, server } = answersConfig;
  const serveDir = server ? 'server/**' : '!server/**';
  console.log('serveDir', serveDir);
  let downTemplateSpinner = ora(chalk.cyan('模板下载中...')).start();
  return new Promise((resolve, reject) => {
    shell.exec(`
      mkdir ${projectDir}
      cd ${projectDir}
      git init
      git remote add -f origin ${remote}
      git pull --depth=1 origin master
      rm -rf .git
      `, (error) => {
        if (error) {
          downTemplateSpinner.stop()
          ora(chalk.red(`模板下载失败：${error}`)).fail()
          reject()
        }
        downTemplateSpinner.stop();
        ora(chalk.cyan('模板下载成功')).succeed();
        resolve();
      })
  })
}

async function GenaratePackageJson(projectDir) {
  try {
    const { name, description, cssPreprocessor, template } = answersConfig;
    const packageJsonPath = path.resolve(`${currentPath}/${projectDir}`, 'package.json');
    const packageJsonSpinner = ora(chalk.cyan('配置 package.json 文件...')).start();
    let package = await fs.readJson(packageJsonPath);
    package.name = name;
    package.description = description;
    if (cssPreprocessor == 'less') {
      package.devDependencies = {
        ...package.devDependencies,
        "less-loader": "^5.0.0",
        "less": "^3.9.0"
      }
    }
    if (cssPreprocessor == 'sass') {
      package.devDependencies = {
        ...package.devDependencies,
        "node-sass": "^4.12.0",
        "sass-loader": "^7.1.0"
      }
    }
    if (template == "react-ssr-project") {
      package.dependencies = {
        ...package.dependencies,
      };
      package.devDependencies = {
        ...package.devDependencies,
      }
    }
    await fs.writeJson(packageJsonPath, package, { spaces: '\t' });
    packageJsonSpinner.stop();
    ora(chalk.cyan('package.json 配置完成')).succeed();
  } catch (error) {
    if (error) {
      ora(chalk.red(`配置文件失败：${error}`)).fail();
      process.exit(1);
    };
  }
}

async function GenarateWebpackConfig(targetDir) {
  try {
    const webpackConfigPath = path.resolve(`${currentPath}/${targetDir}/config`, 'webpack.common.ejs');
    const webpackConfigTargetPath = path.resolve(`${currentPath}/${targetDir}/config`, 'webpack.common.js');
    const webpackConfigSpinner = ora(chalk.cyan(`配置 webpack 文件...`)).start();
    let webpackConfig = await fs.readFile(webpackConfigPath, 'utf8');
    let generatedWebpackConfig = ejs.render(webpackConfig, { answers: answersConfig });
    await Promise.all([
      fs.writeFile(webpackConfigTargetPath, generatedWebpackConfig),
      fs.remove(webpackConfigPath)
    ])
    webpackConfigSpinner.stop();
    ora(chalk.cyan(`配置 webpack 完成`)).succeed();
  } catch (error) {
    ora(chalk.red(`配置文件失败：${error}`)).fail();
    process.exit(1);
  }
}

function InstallDependencies(targetDir) {
  const installDependenciesSpinner = ora(chalk.cyan(`安装依赖中...`)).start();
  return new Promise((resolve, reject) => {
    shell.exec(`
    cd ${targetDir}
    npm i
    `, (error) => {
        if (error) {
          installDependenciesSpinner.stop()
          ora(chalk.red(`依赖安装失败：${error}`)).fail()
          reject()
        }
        installDependenciesSpinner.stop();
        ora(chalk.cyan('依赖安装完成')).succeed();
        resolve();
      })
  })
}

async function GenarateProject(targetDir) {
  await DownTemplate(targetDir);
  await Promise.all([GenaratePackageJson(targetDir).then(() => {
    return InstallDependencies(targetDir);
  }),
  //GenarateWebpackConfig(targetDir)
  ]);
  ora(chalk.cyan('项目创建成功！')).succeed();
  process.exit(1);
}

program
  .arguments('<command>')
  .action((cmd) => {
    console.log();
    console.log(chalk.red(`！命令未能解析 <${chalk.green(cmd)}>`));
    console.log();
    program.outputHelp();
    console.log();
  });

program.parse(process.argv);


if (program.args.length === 0) {
  console.log();
  console.log(chalk.red('！输入的命令有误'));
  console.log();
  chalk.cyan(program.help());
}