import { DateTime } from "luxon";
import prompts from "prompts";

abstract class Display {
  abstract displayElement(data: any): void;

  async display(data: any[]) {
    data.forEach((e) => this.displayElement(e));
    console.log("");
    await prompts({
      type: "confirm",
      name: "_back",
      message: "Back",
    });
  }
}

interface IClass {
  new (): Display;
}

export class DisplayData {
  static async display(DisplayClass: IClass, data: any[]) {
    const obj = new DisplayClass();
    await obj.display(data);
  }
}

export class DisplayMovements extends Display {
  displayElement(data: any): void {
    console.log("");
    console.log("Movement:");
    console.log("date:", DateTime.fromISO(data.date).toLocaleString());
    console.log("amount:", data.amount);
    console.log("description:", data.description);
  }
}

export class DisplayExpenses extends Display {
  displayElement(data: any): void {
    console.log("");
    console.log(`${data.category}:`);
    data.content.forEach((movement: any) => {
      console.log("");
      console.log(" date:", DateTime.fromISO(movement.date).toLocaleString());
      console.log(` amount: ${movement.amount} ${data.currency}`);
    });
    console.log("");
  }
}
