# Orientación para agentes

Leer primero [INDEX.md](INDEX.md) y el [registro de cambios](docs/producto/CAMBIOS.md).

- La prioridad actual es el brainstorming de producto y la organización, no iniciar automáticamente el siguiente bloque técnico histórico.
- Separar decisiones confirmadas, propuestas y trabajo implementado. Las propuestas abiertas no autorizan cambios de comportamiento.
- Los planes de `docs/archivo/` son antecedentes y pueden contener estados desactualizados.
- Consultar `docs/ENTORNO_LOCAL.md` antes de ejecutar pruebas con base de datos. Utilizar una base descartable para pruebas que creen o eliminen registros.
- Preservar los cambios existentes del usuario. No exponer `.env`, respaldos o credenciales en respuestas o documentación.
- Mantener actualizado el índice si se mueven documentos o puntos de entrada.
- Al terminar cada tarea, revisar los cambios para confirmar que no se exponen secretos, commitear con un mensaje descriptivo y hacer `git push` cuando haya remoto configurado.
