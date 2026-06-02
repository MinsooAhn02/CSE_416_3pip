## 🔧 To Fix

1.   주요 뉴스 = 트랜드 (AI breifing에서 똑같이 나옴, 둘이 달라야 하는데 ai breifing 쓰는 로직 체크)
2.   스마트 위젯 키워드가 keyboard인데 카테고리가 book으로 고정됨 근데 드롭다운은 tech임 (표시 오차)
3.   스마트 위젯 데이터 들이 다들 옛날거임 - 5월 20일꺼 보여줌
4.   로그인시  자동 refresh 안됨 (스마트 위젯, 주식이 시간이 오래된 데이타)
5.   사이드 바가 너무 작아서 별로임 -> widget들이 너무 모여 있어서 좀 크기 늘리면 좋을듯?
6.   스마트 위젯 추가버튼 누르고 뜨는 keyword 입력 box가 이상함
7.   AI briefing 자동으로 업뎃됨 - 정해논 시간마다가 아니라 맘대로 업뎃이 되버림 (스마트 위젯이 추가 되서 그런가)
8.   달력에 event 추가할떄 no reminder default
9.   Event 추가 scroll 없이 한 화면에 보여지면 좋겠음. 가로가 짧아서 뭔가 마우스 스크롤 또 해야하는 귀찮음이 생김
10.   달력 숫자는 작은데 밑에 글씨가 크니까 이상함 -> 조절 해야할거 같은데
11.   Data priorpity 에서 smart widget도 각각 - 현재 그냥 smart widget 그룹으로 되어 있는거 같음
12.   Pin 설정 할떄 자동으로 넘어가게 -> PIN 입력하고 확인 PIN 한번더 할때 자동으로 확인 핀 입력으로 넘어가게 굳이 마우스로 클릭 안하게
13.   스마트 위젯의 카테고리 기능의 쓸모? -> 별로인거 같은데 쓸모 있을까?
14. 날씨 위젯 안에 영어로 뜨는 문제가 있음 (한국어여도) 하드코딩 체크
15. 주식이 잘 연동이 안되는거 같아 테스트
16. 창 작아지면 widget 닫아주기 - > 그 버튼 hovering 하드코딩
17. tavily API 효율 성 챙기기 지금 smart widget 별로 부르기도 하고 그런데 최대한 한번에 부를수 있을때 같이 묶어서 보내면 좋을거 같은데
18. google reconnect 문제

## 📌 작업 원칙

- plan with opus, work with sonnet (switch model required)
- ask questions if unclear
- After the entire execution, update in @DOCS.md