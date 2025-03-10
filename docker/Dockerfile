FROM nvidia/cuda:12.0.0-base-ubuntu22.04

ENV TZ=Asia/Tokyo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# ユーザー追加
ARG USERNAME=user
ARG GROUPNAME=user
ARG UID=1000
ARG GID=1000
ARG PASSWORD=user
RUN groupadd -g $GID $GROUPNAME && \
    useradd -m -s /bin/bash -u $UID -g $GID -G sudo $USERNAME && \
    echo $USERNAME:$PASSWORD | chpasswd && \
    echo "$USERNAME   ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
WORKDIR /home/work

RUN apt update && apt install vim graphviz wget git curl build-essential libgl1 -y

# Step1: Python 3.11のインストール
RUN apt install software-properties-common -y && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt update && \
    apt install python3.11 python3.11-venv python3.11-dev -y && \
    ln -s /usr/bin/python3.11 /usr/bin/python

# # Step2: Poetryの設定
ENV POETRY_HOME=/opt/poetry
ENV PATH $PATH:/home/work/.local/bin
RUN curl -sSL https://install.python-poetry.org | python3.11 - && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry && \
    poetry config --local virtualenvs.in-project true

