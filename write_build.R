# Chạy tự động sau khi Quarto render xong (khai báo ở post-render trong _quarto.yml)
# Tạo file last-build.json để trang web biết có bản build mới và tự tải lại.
out_dir <- Sys.getenv("QUARTO_PROJECT_OUTPUT_DIR", "_site")
build_time <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S", tz = "Asia/Ho_Chi_Minh")
writeLines(sprintf('{"buildTime": "%s"}', build_time),
           file.path(out_dir, "last-build.json"), useBytes = TRUE)
message("Da ghi last-build.json: ", build_time)
