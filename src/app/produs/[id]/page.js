import ProdusManagement from "./Client";


const Page = async ({ params }) => {
    const { id } = await params;
    return <ProdusManagement id={id} />;
};

export default Page;