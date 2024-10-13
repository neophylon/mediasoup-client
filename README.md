## For using typescript
debian@debian:~$mkdir mediasoup-client
debian@debian:~/mediasoup-client$cd mediasoup-client
#generate packagejson
debian@debian:~/mediasoup-client$npm init -y
#install typescript
debian@debian:~/mediasoup-client$npm install typescript ts-node
#install Node.js type declation file
debian@debian:~/mediasoup-client$npm install @types/node

Created a new tsconfig.json with:

  target: es2016
  module: commonjs
  strict: true
  esModuleInterop: true
  skipLibCheck: true
  forceConsistentCasingInFileNames: true


You can learn more at https://aka.ms/tsconfig
debian@debian:~/mediasoup-client$