mkdir distr\libs_js
copy /Y src\libs_js\*.js distr\libs_js\
tsc src\%1 -outDir distr --module amd
