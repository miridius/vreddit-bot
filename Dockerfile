# Start with the most recent AWS Lambda Nodejs version
FROM public.ecr.aws/lambda/nodejs:20

# Add yarn
RUN npm i -g yarn && npm cache clean --force

# Add Python 3 & other dependencies
RUN dnf install python3 openssl -y && dnf clean all && rm -rf /var/cache/yum

# Add ffmpeg
COPY ffmpeg/bin/ffmpeg ${LAMBDA_TASK_ROOT}/ffmpeg/bin/ffmpeg

# Install dependencies with yarn
COPY package.json yarn.lock ${LAMBDA_TASK_ROOT}/
RUN yarn install --frozen-lockfile --production && yarn cache clean
# For some reason the lambda function doesn't have access to the files otherwise:
RUN chmod -R 755 ${LAMBDA_TASK_ROOT}/*

# Copy function code
COPY src/ ${LAMBDA_TASK_ROOT}/src
RUN chmod -R 755 ${LAMBDA_TASK_ROOT}/src/*

# Workaround for https://github.com/aws/aws-lambda-base-images/issues/137
ENV LD_LIBRARY_PATH=""