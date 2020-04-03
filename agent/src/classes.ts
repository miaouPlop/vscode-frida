interface IJavaClass {
  name?: string;
  fullPackage?: string;
  methods?: IJavaMethod[];
}

interface IJavaMethod {
  name: string;
  returnType: string;
  parameters: string[];
}

export function enumerateJavaClasses(): string[] {
  if (!Java.available) {
    return [];
  }

  let classes: string[] = [];

  Java.perform(() => {
    // classes = Java.enumerateLoadedClassesSync();
    Java.enumerateLoadedClasses({
      onMatch: (name) => classes.push(name),
      onComplete: () => {}
    });
  });

  return classes;
}

export function enumerateClassMethods(c: string): IJavaClass {
  if (!Java.available) {
    return {};
  }

  let jclass: IJavaClass = {};

  Java.performNow(() => {
    try {
      let klass: Java.Wrapper = Java.use(c);
      const name: string = klass.$className;
      const fullPackage: string = name.split('.').slice(0, -1).join('.');

      let methods: IJavaMethod[] = klass.class.getDeclaredMethods().map((m: any) => {
        let ret: string = m.getReturnType().getName();
        let params: string[] = m.getParameterTypes().map((p: any) => p.getName());

        return { name: m.getName(), returnType: ret, parameters: params };
      });

  
      klass.$dispose;

      jclass = { name: name, fullPackage: fullPackage, methods: methods };
    } catch (e) {}
  });

  return jclass;
}