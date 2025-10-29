import os
import cv2
import uuid
import subprocess
from flask import Flask, render_template, request, send_file, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["PROCESSED_FOLDER"] = "processed"
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # ✅ 500 MB upload limit

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(app.config["PROCESSED_FOLDER"], exist_ok=True)


def merge_audio(original_video, processed_video, output_video):
    cmd = [
        "ffmpeg", "-y",
        "-i", processed_video,
        "-i", original_video,
        "-c:v", "copy",
        "-c:a", "aac",
        "-map", "0:v:0",
        "-map", "1:a:0",
        output_video
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files["video"]
    filename = secure_filename(file.filename)
    video_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(video_path)

    cap = cv2.VideoCapture(video_path)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        return jsonify({"error": "Could not read video"}), 500

    preview_frame = f"{uuid.uuid4()}.jpg"
    preview_path = os.path.join(app.config["PROCESSED_FOLDER"], preview_frame)
    cv2.imwrite(preview_path, frame)

    return jsonify({"frame": preview_frame, "video": filename})


@app.route("/process", methods=["POST"])
def process():
    video_filename = request.form["video"]
    x = int(request.form["x"])
    y = int(request.form["y"])
    w = int(request.form["w"])
    h = int(request.form["h"])

    video_path = os.path.join(app.config["UPLOAD_FOLDER"], video_filename)
    temp_output = os.path.join(app.config["PROCESSED_FOLDER"], "temp.mp4")
    final_output = os.path.join(app.config["PROCESSED_FOLDER"], "output_with_audio.mp4")

    cap = cv2.VideoCapture(video_path)
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    writer = cv2.VideoWriter(temp_output, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        mask = cv2.rectangle(frame.copy(), (x, y), (x + w, y + h), (255, 255, 255), -1)
        gray_mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
        inpaint = cv2.inpaint(frame, gray_mask, 3, cv2.INPAINT_TELEA)
        writer.write(inpaint)

    cap.release()
    writer.release()

    merge_audio(video_path, temp_output, final_output)

    return jsonify({"output": "output_with_audio.mp4"})


@app.route("/download/<filename>")
def download(filename):
    return send_file(os.path.join(app.config["PROCESSED_FOLDER"], filename), as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True)
