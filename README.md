# Note Merge (Codex-ready)

이 폴더는 기존 단일 HTML을 **모듈 구조**로 정리한 버전입니다.

## 폴더 구조
- index.html
- styles.css
- src/
  - main.js (엔트리)
  - game.js (머지 게임 로직)
  - score.js (OSMD 악보 뷰어 + 수집 시 하이라이트/진해짐)
  - audio.js (WebAudio)
- assets/scores/
  - ssak_song.musicxml
- vendor/
  - opensheetmusicdisplay.min.js (OSMD)

## 실행
가장 안정적인 방법은 로컬 서버로 실행하는 것입니다:

```bash
python -m http.server 8000
```

그 다음 브라우저에서 `http://localhost:8000` 접속.

## OSMD 파일 받기 (로컬 사용)
vendor/opensheetmusicdisplay.min.js 가 비어있거나 없으면 OSMD가 안 뜹니다.
다음 중 하나로 다운로드해서 `vendor/opensheetmusicdisplay.min.js`로 넣어주세요:

### macOS / Linux
```bash
curl -L "https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.3/build/opensheetmusicdisplay.min.js" -o vendor/opensheetmusicdisplay.min.js
```

### Windows PowerShell
```powershell
iwr "https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.3/build/opensheetmusicdisplay.min.js" -OutFile "vendor/opensheetmusicdisplay.min.js"
```

## 다음 개선 포인트
- MusicXML 이벤트 ↔ 렌더 노트 매칭 정밀도 개선(Chord/슬러/특수기호 보정)
- “타입(8분음표) 우선”이 아니라 **악보 진행 순서** 기반으로 reveal
- 스테이지별 악보/목표 자동 로딩(데이터 파일 분리)
