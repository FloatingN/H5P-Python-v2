H5P-Python
- dist (весь код)/
	- h5p-python.css
	- h5p-python.js
- language/
	- .en.json
- src/
	- entries/
		- h5p-python.js
	- scripts/
		- h5p-python.js
		- h5p-python-content.js
	- styles/
		- h5p-python.css
- ./
	- library.json
	- package.json
	- package-lock.json
	- semantics.json
	- webpack.config.js

\
\
H5P-boilerplate
- dist/
	- h5p-hello-world.css
		- Просто стили для клиента
	- h5p-hello-world.js
		- Код в минимизированном стиле
			- import из h5p-hello-world.js заменяется на обфусцированный код лежащий в scripts
- src/
	- entries/
		- h5p-hello-world.js
			- Подключаем файлы из стилей и из скриптов, и запускаем H5P
	- scripts/
		- h5p-hello-world.js
			- Код для создания элемента на стороне пользователя
	- styles/
		- h5p-hello-world.css
- ./
	- library.json
		- Описание пакета, и описание что подгружать файлы из dist
	- package.json
		- Описание для запуска npm
	- package-lock.json
		- Более точное описание для запуска npm
	- semantics.json
		- Описание элемента на стороне пользователя (а может и на стороне редактора)
			- В данном случае кажется это просто текстовое поле