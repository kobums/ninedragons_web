tag=latest

all: run

run:
	npm run dev

build:
	npm run build

# 아래 docker/push 는 레거시다. 운영 프론트는 이 이미지가 아니라 모노레포의
# 통합 정적 nginx 이미지(kobums/gowoobro_static_web)로 배포된다. DEPLOYMENT.md 참고.
docker: build
	docker buildx build --platform linux/amd64 -t kobums/ninedragons_web:$(tag) --load .

push: build
	docker buildx build --platform linux/amd64 -t kobums/ninedragons_web:$(tag) --push .

dummy:
