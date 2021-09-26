# Start with the most recent AWS Lambda Nodejs version
FROM public.ecr.aws/lambda/nodejs:latest

# Add yarn
RUN npm i -g yarn && npm cache clean --force

# Add Python
RUN yum install python -y && yum clean all && rm -rf /var/cache/yum

# Add ffmpeg
COPY ffmpeg/bin/ffmpeg ${LAMBDA_TASK_ROOT}/ffmpeg/bin/ffmpeg

# Install dependencies with yarn
COPY package.json yarn.lock ${LAMBDA_TASK_ROOT}/
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy function code
COPY src/ ${LAMBDA_TASK_ROOT}/src
